import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled, { css } from "styled-components";
import { theme } from "./theme";
import { useTranslation } from "react-i18next";
import { wipeAll } from "./services/offlineSetlistService";
import { performUserSignOut } from "./context/offlineAuthController";
import { useBandContext } from "./context/useBandContext";
import { useToast } from "./context/useToast";
import { signOutEverywhereOrLocally } from "./lib/authSession";
import { getPwaUpdater } from "./lib/pwaUpdates";

/**
 * The account menu, in two layouts:
 *
 * - `dropdown` (default): the desktop navbar. A trigger with the avatar (and
 *   the email, unless `compact`) opens a floating menu below it, closed by
 *   Escape, a click outside or the trigger.
 * - `inline`: the mobile navigation drawer. The same content rendered flat
 *   (account header, language, About, Check for updates, Sign out) as rows of
 *   the drawer itself: a floating menu anchored to the drawer's last row opened
 *   below the viewport and had to be scrolled into view.
 *
 * `onAction` fires when an action finished (sign-out done, update check
 * answered, About opened) so the drawer can close.
 */
interface AuthButtonProps {
  variant?: "dropdown" | "inline";
  onAction?: () => void;
  /** Desktop header: avatar + chevron only; the email stays in the open menu. */
  compact?: boolean;
}

export const AuthButton: FC<AuthButtonProps> = ({ variant = "dropdown", onAction, compact = false }) => {
  const { t, i18n } = useTranslation();
  // The context's user, not a second getSession(): offline that call can take
  // ≈25 s, and the navbar must agree with the rest of the app (spec §7.1).
  const { user, authMode, isCheckingAuth } = useBandContext();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inline = variant === "inline";

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
    onAction?.();
  }, [toast, t, onAction]);

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
    onAction?.();
  }, [toast, t, onAction]);

  // Dropdown only: close on Escape and on a click outside the menu.
  useEffect(() => {
    if (inline || !showUserMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowUserMenu(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [inline, showUserMenu]);

  // Nothing while auth resolves (≤ 750 ms with a last-user, A6): no "Sign in" flash.
  if (isCheckingAuth) return null;

  if (!user) {
    return (
      <SignInContainer $inline={inline}>
        <SignInButton onClick={redirectToLogin} $inline={inline}>
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
  const avatar = (
    <UserAvatar $inline={inline} aria-hidden="true">
      {isOfflineAccount ? <i className="bi bi-person"></i> : userLabel.charAt(0).toUpperCase()}
    </UserAvatar>
  );

  const accountInfo = user.email ? (
    <>
      <UserInfoLabel>{t('auth.signedInAs')}</UserInfoLabel>
      <UserInfoEmail>{user.email}</UserInfoEmail>
    </>
  ) : authMode === "offline-cached" ? (
    <UserInfoLabel>{t('auth.offlineAccountHint')}</UserInfoLabel>
  ) : (
    <UserInfoEmail>{userLabel}</UserInfoEmail>
  );

  const items = (
    <>
      <LanguageSection $inline={inline}>
        <LanguageLabel $inline={inline}>
          <i className="bi bi-globe"></i>
          <span>{t('settings.language')}</span>
        </LanguageLabel>
        <LanguageButtons role="group" aria-label={t('settings.language')}>
          <LanguageButton
            $active={i18n.language === 'en' || i18n.language.startsWith('en-')}
            aria-pressed={i18n.language === 'en' || i18n.language.startsWith('en-')}
            onClick={() => changeLanguage('en')}
          >
            EN
          </LanguageButton>
          <LanguageButton
            $active={i18n.language === 'es' || i18n.language.startsWith('es-')}
            aria-pressed={i18n.language === 'es' || i18n.language.startsWith('es-')}
            onClick={() => changeLanguage('es')}
          >
            ES
          </LanguageButton>
        </LanguageButtons>
      </LanguageSection>
      {!inline && <MenuDivider />}
      {/* /about needs no connection: shown in session and offline-cached. */}
      <MenuItem
        as={Link}
        to="/about"
        $inline={inline}
        onClick={() => {
          setShowUserMenu(false);
          onAction?.();
        }}
      >
        <i className="bi bi-info-circle"></i>
        <span>{t('nav.about')}</span>
      </MenuItem>
      <MenuItem $inline={inline} onClick={checkForUpdate} disabled={checkingUpdate}>
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
      </MenuItem>
      <MenuItem $inline={inline} onClick={logout} disabled={loading}>
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
      </MenuItem>
    </>
  );

  if (inline) {
    return (
      <AccountPanel data-testid="account-panel">
        <AccountHeader>
          {avatar}
          <AccountHeaderText>{accountInfo}</AccountHeaderText>
        </AccountHeader>
        {items}
      </AccountPanel>
    );
  }

  return (
    <UserMenuContainer ref={menuRef}>
      <UserButton
        $compact={compact}
        onClick={() => setShowUserMenu(!showUserMenu)}
        disabled={loading}
        aria-label={t('auth.userMenu')}
        aria-haspopup="menu"
        aria-expanded={showUserMenu}
      >
        {avatar}
        {!compact && <UserEmail>{userLabel}</UserEmail>}
        <i className={`bi bi-chevron-${showUserMenu ? 'up' : 'down'}`}></i>
      </UserButton>

      {showUserMenu && (
        <UserDropdown role="menu">
          <UserInfo>{accountInfo}</UserInfo>
          <MenuDivider />
          {items}
        </UserDropdown>
      )}
    </UserMenuContainer>
  );
};

// Styled Components

const SignInContainer = styled.div<{ $inline: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex-wrap: wrap;
  ${(props) => props.$inline && css`width: 100%;`}

  @media (max-width: ${theme.breakpoints.sm}) {
    gap: ${theme.space[2]};
  }
`;

const SignInButton = styled.button<{ $inline: boolean }>`
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
  justify-content: center;
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

  ${(props) =>
    props.$inline
      ? css`
          width: 100%;
          height: 48px;
          font-size: ${theme.fontSizes.body};
        `
      : css`
          span {
            @media (max-width: ${theme.breakpoints.sm}) {
              display: none;
            }
          }
        `}
`;

const UserMenuContainer = styled.div`
  position: relative;
`;

const UserButton = styled.button<{ $compact: boolean }>`
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
  min-width: ${(props) => (props.$compact ? "0" : "120px")};

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brand.primary};
    background: var(--color-bg-elevated);
  }

  &[aria-expanded="true"] {
    border-color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  > i {
    font-size: 12px;
    margin-left: auto;
  }
`;

const UserAvatar = styled.div<{ $inline: boolean }>`
  width: ${(props) => (props.$inline ? "40px" : "28px")};
  height: ${(props) => (props.$inline ? "40px" : "28px")};
  border-radius: ${theme.radius.full};
  background: ${theme.gradients.brandPrimary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${(props) => (props.$inline ? theme.fontSizes.body : theme.fontSizes.bodySm)};
  color: white;
  flex-shrink: 0;

  i {
    font-size: ${(props) => (props.$inline ? theme.fontSizes.h5 : theme.fontSizes.body)};
    margin: 0;
  }
`;

const UserEmail = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
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

const MenuDivider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: ${theme.space[2]} 0;
`;

/* Inline (drawer) layout: the account header and the rows below it share the
   drawer's nav-link rhythm (48 px rows, 24 px icon column). */
const AccountPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
  width: 100%;
`;

const AccountHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[2]} ${theme.space[2]} ${theme.space[3]};
  min-width: 0;
`;

const AccountHeaderText = styled.div`
  min-width: 0;
  flex: 1;

  ${UserInfoLabel} {
    margin-bottom: 2px;
  }

  ${UserInfoEmail} {
    font-size: ${theme.fontSizes.body};
    overflow-wrap: anywhere;
    word-break: normal;
  }
`;

const rowStyles = css`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  min-height: 48px;
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-secondary);

  i {
    font-size: ${theme.fontSizes.h5};
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
  }
`;

const MenuItem = styled.button<{ $inline: boolean }>`
  width: 100%;
  background: transparent;
  border: none;
  text-align: left;
  /* Also rendered as a Link (About): look like the button rows. */
  text-decoration: none;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  ${(props) =>
    props.$inline
      ? css`
          ${rowStyles}

          &:hover:not(:disabled) {
            color: ${theme.colors.brand.primary};
            background: var(--color-bg-tertiary);
            transform: translateX(4px);
          }
        `
      : css`
          color: var(--color-text-primary);
          padding: ${theme.space[3]} ${theme.space[4]};
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

          &:last-of-type {
            border-radius: 0 0 ${theme.radius.md} ${theme.radius.md};
          }
        `}

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const LanguageSection = styled.div<{ $inline: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  ${(props) =>
    props.$inline
      ? css`
          ${rowStyles}
        `
      : css`
          padding: ${theme.space[3]} ${theme.space[4]};
        `}
`;

const LanguageLabel = styled.div<{ $inline: boolean }>`
  display: flex;
  align-items: center;
  gap: ${(props) => (props.$inline ? theme.space[3] : theme.space[2])};
  font-size: ${(props) => (props.$inline ? theme.fontSizes.body : theme.fontSizes.bodySm)};
  color: ${(props) => (props.$inline ? "inherit" : "var(--color-text-primary)")};

  i {
    ${(props) =>
      !props.$inline &&
      css`
        font-size: ${theme.fontSizes.body};
        color: var(--color-text-secondary);
      `}
  }
`;

const LanguageButtons = styled.div`
  display: flex;
  gap: ${theme.space[1]};
  flex-shrink: 0;
`;

const LanguageButton = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-bg-tertiary)'};
  color: ${(props) =>
    props.$active ? 'white' : 'var(--color-text-secondary)'};
  border: 1px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-border)'};
  padding: ${theme.space[1]} ${theme.space[2]};
  min-width: 40px;
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
