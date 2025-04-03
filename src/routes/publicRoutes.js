const express = require("express");
const {
  login,
  logout,
  register,
  confirmarCorreo,
  restablecerContrasena,
} = require("../controllers/publicController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/confirmar-correo", confirmarCorreo);
router.post("/restablecer-contrasena", restablecerContrasena);

module.exports = router;
