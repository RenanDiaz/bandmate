const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const UserAuth = require("../models/userAuthModel");
const PersonaIndividual = require("../models/personaIndividualModel");
const EmpresaPersonaNatural = require("../models/empresaPersonaNaturalModel");
const EmpresaPersonaJuridica = require("../models/empresaPersonaJuridicaModel");
const Vinculacion = require("../models/vinculacionModel");
const { createUsuarioLMS } = require("./lmsController");
const { generateAccessToken } = require("../middlewares/authMiddleware");
const {
  enviarCorreoDeConfirmacion,
  enviarCorreoDeRestablecimientoDeContrasena,
  enviarCorreoDeNuevoRegistro,
} = require("../utils/mailer");
const { generateEmailToken, verifyEmailToken } = require("../utils/emailVerificationToken");
const { generarContraseñaAleatoria } = require("../utils/generator");

const register = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { usuario, empresa } = req.body;
    const {
      correo,
      contrasena,
      nombre,
      apellidos,
      identificacion,
      tipoDeIdentificacion,
      nacionalidad,
      tipoDeSangre,
      telefono,
      direccionDeResidencia,
      alergias,
      discapacidades,
      enfermedades,
      medicamentos,
      contactosDeEmergencia,
    } = usuario;

    const personaIndividual = new PersonaIndividual({
      correo,
      nombre,
      apellidos,
      identificacion,
      tipoDeIdentificacion,
      nacionalidad,
      tipoDeSangre,
      telefono,
      direccionDeResidencia,
      alergias,
      discapacidades,
      enfermedades,
      medicamentos,
      contactosDeEmergencia,
    });

    if (empresa) {
      const {
        nombreDeLaEmpresa,
        ruc,
        digitoVerificador,
        tipoDeIndustria,
        direccion,
        isPersonaNatural,
      } = empresa;
      if (isPersonaNatural) {
        const { nombreDelPropietario, cedulaDelPropietario } = empresa;
        const empresaPersonaNatural = new EmpresaPersonaNatural({
          nombreDeLaEmpresa,
          ruc,
          digitoVerificador,
          tipoDeIndustria,
          direccion,
          nombreDelPropietario,
          cedulaDelPropietario,
        });
        await empresaPersonaNatural.save({ session });

        personaIndividual.ultimaEmpresaSeleccionada = empresaPersonaNatural._id;

        const vinculacion = new Vinculacion({
          persona: personaIndividual._id,
          empresa: empresaPersonaNatural._id,
          cargo: null,
          rol: "administrador",
          permisos: [],
          fechaDeVinculacion: Date.now(),
        });
        await vinculacion.save({ session });
      } else {
        const empresaPersonaJuridica = new EmpresaPersonaJuridica({
          nombreDeLaEmpresa,
          ruc,
          digitoVerificador,
          tipoDeIndustria,
          direccion,
        });
        await empresaPersonaJuridica.save({ session });

        personaIndividual.ultimaEmpresaSeleccionada = empresaPersonaJuridica._id;

        const vinculacion = new Vinculacion({
          persona: personaIndividual._id,
          empresa: empresaPersonaJuridica._id,
          cargo: null,
          rol: "administrador",
          permisos: [],
          fechaDeVinculacion: Date.now(),
        });
        await vinculacion.save({ session });
      }
    }
    await personaIndividual.save({ session });

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(contrasena, salt);

    const user = new UserAuth({
      correo,
      contrasena: hashedPassword,
      persona: personaIndividual._id,
    });

    await user.save({ session });

    await createUsuarioLMS(usuario);

    await session.commitTransaction();
    session.endSession();

    const { protocol, hostname } = req;
    const controlDeAcceso = process.env.CONTROL_DE_ACCESO === "true";
    if (controlDeAcceso) {
      enviarCorreoDeNuevoRegistro(
        `${nombre} ${apellidos}`,
        `${protocol}://${hostname}/admin/login`
      );
    } else {
      const token = await generateEmailToken(correo);
      enviarCorreoDeConfirmacion(
        correo,
        nombre,
        `${protocol}://${hostname}/confirmar-correo/${token}`
      );
    }

    res.status(201).json({
      creado: true,
      mensaje: "Usuario registrado exitosamente",
      autorizado: !controlDeAcceso,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error(error);
    console.error(error.message);
    const errorMessage = error.message;
    const errorObject = {
      message:
        "Hubo un error al guardar los datos del registro. Por favor inténtelo de nuevo más tarde.",
    };

    if (errorMessage.includes("duplicate key error")) {
      if (errorMessage.includes("{") && errorMessage.includes("}")) {
        const match = errorMessage.match(/\{([^:]+)\:/);
        if (match && match.length > 1) {
          const fieldName = match[1].trim();
          console.error(`The field "${fieldName}" is causing the issue.`);
          errorObject.message = `Ya existe un usuario o empresa con el valor asignado al campo "${fieldName}".`;
          errorObject.dup = { fieldName };
        }
      }
    }
    res.status(500).json(errorObject);
  }
};

const login = async (req, res, next) => {
  try {
    const { correo, contrasena } = req.body;

    const user = await UserAuth.findOne({ correo });

    if (!user) {
      return res.status(401).json({
        message:
          "Credenciales incorrectas. Por favor, verifica tu correo y contraseña e inténtalo de nuevo.",
      });
    }

    const isMatch = await bcrypt.compare(contrasena, user.contrasena);

    if (!isMatch) {
      return res.status(401).json({
        message:
          "Credenciales incorrectas. Por favor, verifica tu correo y contraseña e inténtalo de nuevo.",
      });
    }

    if (!user.correoConfirmado) {
      return res.status(403).json({
        message:
          "Por favor, confirma tu correo electrónico para poder iniciar sesión. Revisa tu correo y sigue las instrucciones.",
      });
    }

    if (user.tiempoDePrueba && user.tiempoDePrueba < new Date()) {
      return res.status(403).json({
        message:
          "Tu tiempo de prueba ha expirado. Por favor, comunícate con el administrador del sistema para obtener acceso.",
      });
    }

    const token = generateAccessToken(user._id);

    res.json({ token });
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const { correo, contrasena } = req.body;

    const isMatch = correo === process.env.ADMIN_USER && contrasena === process.env.ADMIN_PASS;

    if (!isMatch) {
      return res.status(401).json({
        message:
          "Credenciales incorrectas. Por favor, verifica tu correo y contraseña e inténtalo de nuevo.",
      });
    }

    const token = generateAccessToken("admin");

    res.json({ token });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error al cerrar sesión:", err);
        res.status(500).json({ message: "Error al cerrar sesión" });
      } else {
        res.status(200).json({ message: "Sesión cerrada exitosamente" });
      }
    });
  } else {
    res.status(401).json({ message: "No hay sesión activa para cerrar" });
  }
};

const confirmarCorreo = async (req, res, next) => {
  try {
    const { token } = req.query;
    const { email } = await verifyEmailToken(token);
    if (!email) {
      return res.status(400).json({ valido: false, message: "Token inválido" });
    }
    const user = await UserAuth.findOne({ correo: email });
    if (!user) {
      return res.status(404).json({
        valido: false,
        message: "No existe un usuario con el correo proporcionado",
      });
    }
    await UserAuth.findByIdAndUpdate(user._id, { correoConfirmado: true });
    res.json({ valido: true, message: "Correo confirmado exitosamente" });
  } catch (error) {
    next(error);
  }
};

const restablecerContrasena = async (req, res, next) => {
  try {
    const { correo } = req.body;

    const user = await UserAuth.findOne({ correo }).populate("persona");

    if (!user) throw new Error(`No existe un usuario registrado con el correo ${correo}`);

    const salt = await bcrypt.genSalt(10);
    const nuevaContrasena = generarContraseñaAleatoria();
    const hashedPassword = await bcrypt.hash(nuevaContrasena, salt);

    await UserAuth.findByIdAndUpdate(user._id, {
      contrasena: hashedPassword,
      cambiarContrasena: true,
    });

    const { protocol, hostname } = req;
    const urlDelSitio = `${protocol}://${hostname}#login`;

    enviarCorreoDeRestablecimientoDeContrasena(
      correo,
      user.persona.nombre,
      nuevaContrasena,
      urlDelSitio
    );

    res.json({ message: "Contraseña nueva enviada al correo" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  adminLogin,
  logout,
  confirmarCorreo,
  restablecerContrasena,
};
