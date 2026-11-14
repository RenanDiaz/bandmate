import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../../theme";
import { PrimaryButton } from "./buttons";

const Wrapper = styled.div`
  margin-top: ${theme.space[4]};
  display: flex;
  justify-content: center;
`;

/**
 * "Sign in" call to action for the signed-out screens of band pages
 * (Songs, Setlists, Shows, Rehearsals, Requests), which otherwise only say
 * that a sign-in is needed.
 */
export function SignInLink() {
  const { t } = useTranslation();
  return (
    <Wrapper>
      <PrimaryButton as={Link} to="/login" style={{ textDecoration: "none" }}>
        <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
        {t("auth.signIn")}
      </PrimaryButton>
    </Wrapper>
  );
}
