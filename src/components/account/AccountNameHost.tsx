import type { FC } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBandContext } from "../../context/useBandContext";
import { useToast } from "../../context/useToast";
import { updateAccountName } from "../../services/accountService";
import { ACCOUNT_NAME_MAX_LENGTH, accountName, isGoogleAccount } from "../../utils/memberNames";
import { TextFieldModal } from "../ui/TextFieldModal";
import { closeAccountName, useAccountNameOpen } from "./accountNameStore";

/**
 * The "Your name" dialog for email-and-password accounts, rendered once in
 * App. Closed when the session or the connection goes, or for a Google
 * account (Google sets that name).
 */
export const AccountNameHost: FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const open = useAccountNameOpen();
  const { user, authMode, isOnline } = useBandContext();
  const available = authMode === "session" && isOnline && !!user && !isGoogleAccount(user.app_metadata);

  useEffect(() => {
    if (!available) closeAccountName();
  }, [available]);

  if (!available) return null;

  const save = async (value: string): Promise<string | null> => {
    try {
      await updateAccountName(value);
      toast.success(t("auth.nameSaved"));
      return null;
    } catch (error) {
      console.error("Saving the account name failed:", error);
      return t("auth.nameError");
    }
  };

  return (
    <TextFieldModal
      isOpen={open}
      title={t("auth.yourName")}
      label={t("auth.nameLabel")}
      hint={t("auth.yourNameHint")}
      initialValue={accountName(user?.user_metadata) ?? ""}
      maxLength={ACCOUNT_NAME_MAX_LENGTH}
      onSave={save}
      onClose={closeAccountName}
    />
  );
};
