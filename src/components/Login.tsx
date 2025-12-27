import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import styled from "styled-components";
import { theme } from "../theme";
import { Logo } from "./Logo";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage(t('auth.checkEmailConfirmation'));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/songs");
      }
    } catch (error: any) {
      setError(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message || "An error occurred");
      setLoading(false);
    }
  };

  return (
    <LoginWrapper>
      <LoginContainer>
        <LoginCard>
          <LogoSection>
            <Logo size={60} variant="icon" />
            <BrandTitle>Bandmate</BrandTitle>
            <BrandSubtitle>{t('auth.manageYourBand')}</BrandSubtitle>
          </LogoSection>

          <FormSection>
            <FormTitle>{isSignUp ? t('auth.createAccount') : t('auth.welcomeBack')}</FormTitle>

            {error && <ErrorMessage><i className="bi bi-exclamation-circle"></i> {error}</ErrorMessage>}
            {message && <SuccessMessage><i className="bi bi-check-circle"></i> {message}</SuccessMessage>}

            <Form onSubmit={handleEmailAuth}>
              <FormGroup>
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  minLength={6}
                />
                {isSignUp && <HelperText>{t('auth.passwordMinLength')}</HelperText>}
              </FormGroup>

              <SubmitButton type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner />
                    {isSignUp ? t('auth.signingUp') : t('auth.signingIn')}
                  </>
                ) : (
                  <>{isSignUp ? t('auth.signUp') : t('auth.signIn')}</>
                )}
              </SubmitButton>
            </Form>

            <Divider>
              <DividerLine />
              <DividerText>{t('common.or')}</DividerText>
              <DividerLine />
            </Divider>

            <GoogleButton onClick={handleGoogleLogin} disabled={loading}>
              <i className="bi bi-google"></i>
              {t('auth.continueWithGoogle')}
            </GoogleButton>

            <ToggleText>
              {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}{" "}
              <ToggleLink onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? t('auth.signIn') : t('auth.signUp')}
              </ToggleLink>
            </ToggleText>

            <BackLink to="/">
              <i className="bi bi-arrow-left"></i> {t('auth.backToHome')}
            </BackLink>
          </FormSection>
        </LoginCard>
      </LoginContainer>
    </LoginWrapper>
  );
};

// Styled Components

const LoginWrapper = styled.div`
  min-height: 100vh;
  background: ${theme.gradients.brandPrimary};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[4]};
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
`;

const LoginContainer = styled.div`
  width: 100%;
  max-width: 440px;
  position: relative;
  z-index: 1;
  animation: fadeInUp 0.5s ease-out;

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const LoginCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.xl};
  box-shadow: ${theme.shadows.xl};
  overflow: hidden;
`;

const LogoSection = styled.div`
  background: ${theme.gradients.brandPrimary};
  padding: ${theme.space[8]} ${theme.space[6]};
  text-align: center;
`;

const BrandTitle = styled.h1`
  font-size: ${theme.fontSizes.h1};
  font-weight: ${theme.fontWeights.bold};
  color: white;
  margin: ${theme.space[3]} 0 ${theme.space[2]};
`;

const BrandSubtitle = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
`;

const FormSection = styled.div`
  padding: ${theme.space[8]} ${theme.space[6]};
`;

const FormTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[6]} 0;
  text-align: center;
`;

const ErrorMessage = styled.div`
  background: ${theme.colors.semantic.errorBgDark};
  border: 1px solid ${theme.colors.semantic.error};
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};

  i {
    font-size: ${theme.fontSizes.body};
    flex-shrink: 0;
  }
`;

const SuccessMessage = styled.div`
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid ${theme.colors.semantic.success};
  color: ${theme.colors.semantic.success};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};

  i {
    font-size: ${theme.fontSizes.body};
    flex-shrink: 0;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const Label = styled.label`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
`;

const Input = styled.input`
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: ${theme.colors.dark.text.tertiary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: ${theme.colors.dark.border.strong};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const HelperText = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
`;

const SubmitButton = styled.button`
  background: ${theme.colors.brand.primary};
  color: white;
  border: none;
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[2]};

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
    box-shadow: ${theme.shadows.md};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const Spinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  margin: ${theme.space[6]} 0;
`;

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${theme.colors.dark.border.default};
`;

const DividerText = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.tertiary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const GoogleButton = styled.button`
  width: 100%;
  background: white;
  color: #3c4043;
  border: 1px solid #dadce0;
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.bodyLg};
    color: #4285f4;
  }

  &:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #d2e3fc;
    transform: translateY(-1px);
    box-shadow: ${theme.shadows.sm};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    background: #f1f3f4;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ToggleText = styled.p`
  text-align: center;
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  margin: ${theme.space[6]} 0 ${theme.space[4]};
`;

const ToggleLink = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.brand.primary};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  text-decoration: none;
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primaryHover};
    text-decoration: underline;
  }
`;

const BackLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  color: ${theme.colors.dark.text.tertiary};
  font-size: ${theme.fontSizes.bodySm};
  text-decoration: none;
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;
