import type { User } from "@supabase/supabase-js";
import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "reactstrap";
import { supabase } from "./lib/supabaseClient";
import styled from "styled-components";
import { theme } from "./theme";

export const AuthButton: FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setUser(user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const redirectToLogin = useCallback(() => {
    window.location.href = "/login";
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setShowUserMenu(false);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!user) {
    return (
      <SignInContainer>
        <SignInButton onClick={redirectToLogin}>
          <i className="bi bi-box-arrow-in-right"></i>
          <span>Sign in</span>
        </SignInButton>
      </SignInContainer>
    );
  }

  const userEmail = user.email || "User";
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <UserMenuContainer>
      <UserButton
        onClick={() => setShowUserMenu(!showUserMenu)}
        disabled={loading}
        aria-label="User menu"
      >
        <UserAvatar>{userInitial}</UserAvatar>
        <UserEmail>{userEmail}</UserEmail>
        <i className={`bi bi-chevron-${showUserMenu ? 'up' : 'down'}`}></i>
      </UserButton>

      {showUserMenu && (
        <UserDropdown>
          <UserInfo>
            <UserInfoLabel>Signed in as</UserInfoLabel>
            <UserInfoEmail>{userEmail}</UserInfoEmail>
          </UserInfo>
          <DropdownDivider />
          <DropdownItem onClick={logout} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-right"></i>
                <span>Sign out</span>
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
    box-shadow: ${theme.shadows.md};
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
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
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
    background: ${theme.colors.dark.bg.elevated};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.md};
  box-shadow: ${theme.shadows.lg};
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
  color: ${theme.colors.dark.text.tertiary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  margin-bottom: ${theme.space[1]};
`;

const UserInfoEmail = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
  word-break: break-all;
`;

const DropdownDivider = styled.div`
  height: 1px;
  background: ${theme.colors.dark.border.default};
  margin: ${theme.space[2]} 0;
`;

const DropdownItem = styled.button`
  width: 100%;
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.primary};
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
    color: ${theme.colors.dark.text.secondary};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.dark.bg.tertiary};
    color: ${theme.colors.brand.primary};

    i {
      color: ${theme.colors.brand.primary};
    }
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &:first-of-type {
    border-radius: 0 0 ${theme.radius.md} ${theme.radius.md};
  }
`;
