import type { FC } from "react";
import { useCallback, useState } from "react";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "./theme";
import { useTranslation } from "react-i18next";
import { wipeAll } from "./services/offlineSetlistService";
import { performUserSignOut } from "./context/offlineAuthController";
import { useBandContext } from "./context/useBandContext";
import { useToast } from "./context/useToast";
import { signOutEverywhereOrLocally } from "./lib/authSession";
import { getPwaUpdater } from "./lib/pwaUpdates";

export const AuthButton: FC = () => {
  const { t, i18n } = useTranslation();
  // The context's user, not a second getSession(): offline that call can take
  // ≈25 s, and the navbar must agree with the rest of the app (spec §7.1).
  const { user, authMode, isCheckingAuth } = useBandContext();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const redirectToLogin = useCallback(() => {
    window.location.href = "/login";
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setShowUserMenu(false);
    try {
      // The only sign-out that deletes offline copies (spec §3.5 #6a): the
      // wipe is awaited before signOut(), and the SIGNED_OUT it causes is
      // recognized as user-initiated rather than a lost session.
      // signOutEverywhereOrLocally ends signed out on this device even when the
      // auth server can't be reached.
      await performUserSignOut(wipeAll, () => signOutEverywhereOrLocally());
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error(t("auth.signOutError"));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  // An installed iOS app has no reload gesture: this is how its user asks for
  // the new version without killing the app.
  const checkForUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const updater = getPwaUpdater();
      const result = await updater.checkForUpdate();
      switch (result) {
        case "update-ready":
          toast.info(t("pwa.updating"));
          updater.applyUpdate();
          return;
        case "up-to-date":
          toast.success(t("pwa.upToDate"));
          break;
        case "offline":
          toast.warning(t("pwa.checkNeedsConnection"));
          break;
        case "unsupported":
          window.location.reload();
          return;
        case "error":
          toast.error(t("pwa.checkFailed"));
          break;
      }
    } finally {
      setCheckingUpdate(false);
    }
    setShowUserMenu(false);
  }, [toast, t]);

  // Nothing while auth resolves (≤ 750 ms with a last-user, A6): no "Sign in" flash.
  if (isCheckingAuth) return null;

  if (!user) {
    return (
      <SignInContainer>
        <SignInButton onClick={redirectToLogin}>
          <i className="bi bi-box-arrow-in-right"></i>
          <span>{t('auth.signIn')}</span>
        </SignInButton>
      </SignInContainer>
    );
  }

  // "offline-cached": only the id is known (no email), so show a generic
  // "Offline" account instead of an address.
  const isOfflineAccount = authMode === "offline-cached" || !user.email;
  const userLabel = user.email ?? (authMode === "offline-cached" ? t("auth.offlineAccount") : t("auth.user"));

  return (
    <UserMenuContainer>
      <UserButton
        onClick={() => setShowUserMenu(!showUserMenu)}
        disabled={loading}
        aria-label={t('auth.userMenu')}
      >
        <UserAvatar>
          {isOfflineAccount ? <i className="bi bi-person" aria-hidden="true"></i> : userLabel.charAt(0).toUpperCase()}
        </UserAvatar>
        <UserEmail>{userLabel}</UserEmail>
        <i className={`bi bi-chevron-${showUserMenu ? 'up' : 'down'}`}></i>
      </UserButton>

      {showUserMenu && (
        <UserDropdown>
          {user.email ? (
            <>
              <UserInfo>
                <UserInfoLabel>{t('auth.signedInAs')}</UserInfoLabel>
                <UserInfoEmail>{user.email}</UserInfoEmail>
              </UserInfo>
              <DropdownDivider />
            </>
          ) : authMode === "offline-cached" ? (
            <>
              <UserInfo>
                <UserInfoLabel>{t('auth.offlineAccountHint')}</UserInfoLabel>
              </UserInfo>
              <DropdownDivider />
            </>
          ) : null}
          <LanguageSection>
            <LanguageLabel>
              <i className="bi bi-globe"></i>
              {t('settings.language')}
            </LanguageLabel>
            <LanguageButtons>
              <LanguageButton
                $active={i18n.language === 'en' || i18n.language.startsWith('en-')}
                onClick={() => changeLanguage('en')}
              >
                EN
              </LanguageButton>
              <LanguageButton
                $active={i18n.language === 'es' || i18n.language.startsWith('es-')}
                onClick={() => changeLanguage('es')}
              >
                ES
              </LanguageButton>
            </LanguageButtons>
          </LanguageSection>
          <DropdownDivider />
          <DropdownItem onClick={checkForUpdate} disabled={checkingUpdate}>
            {checkingUpdate ? (
              <>
                <Spinner size="sm" />
                <span>{t('pwa.checking')}</span>
              </>
            ) : (
              <>
                <i className="bi bi-arrow-repeat"></i>
                <span>{t('pwa.checkForUpdates')}</span>
              </>
            )}
          </DropdownItem>
          <DropdownItem onClick={logout} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>{t('auth.signingOut')}</span>
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-right"></i>
                <span>{t('auth.signOut')}</span>
              </>
            )}
          </DropdownItem>
        </UserDropdown>
      )}
    </UserMenuContainer>
  );
};

// Styled Components

const SignInContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex-wrap: wrap;

  @media (max-width: ${theme.breakpoints.sm}) {
    gap: ${theme.space[2]};
  }
`;

const SignInButton = styled.button`
  background: ${theme.colors.brand.primary};
  color: white;
  border: none;
  padding: ${theme.space[2]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  span {
    @media (max-width: ${theme.breakpoints.sm}) {
      display: none;
    }
  }
`;

const UserMenuContainer = styled.div`
  position: relative;
`;

const UserButton = styled.button`
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  min-width: 120px;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brand.primary};
    background: var(--color-bg-elevated);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  i {
    font-size: 12px;
    margin-left: auto;
  }
`;

const UserAvatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.full};
  background: ${theme.gradients.brandPrimary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  color: white;
  flex-shrink: 0;
`;

const UserEmail = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const UserDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${theme.space[2]});
  right: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.md};
  box-shadow: var(--shadow-lg);
  min-width: 240px;
  z-index: ${theme.zIndex.dropdown};
  animation: slideDown 0.2s ease-out;

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const UserInfo = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
`;

const UserInfoLabel = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  margin-bottom: ${theme.space[1]};
`;

const UserInfoEmail = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  word-break: break-all;
`;

const DropdownDivider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: ${theme.space[2]} 0;
`;

const DropdownItem = styled.button`
  width: 100%;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  text-align: left;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};

  i {
    font-size: ${theme.fontSizes.body};
    color: var(--color-text-secondary);
  }

  &:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    color: ${theme.colors.brand.primary};

    i {
      color: ${theme.colors.brand.primary};
    }
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &:last-of-type {
    border-radius: 0 0 ${theme.radius.md} ${theme.radius.md};
  }
`;

const LanguageSection = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const LanguageLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);

  i {
    font-size: ${theme.fontSizes.body};
    color: var(--color-text-secondary);
  }
`;

const LanguageButtons = styled.div`
  display: flex;
  gap: ${theme.space[1]};
`;

const LanguageButton = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-bg-tertiary)'};
  color: ${(props) =>
    props.$active ? 'white' : 'var(--color-text-secondary)'};
  border: 1px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-border)'};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-elevated)'};
    border-color: ${theme.colors.brand.primary};
    color: ${(props) =>
      props.$active ? 'white' : theme.colors.brand.primary};
  }
`;
