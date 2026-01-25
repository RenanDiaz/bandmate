import { useState, useRef } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";
import {
  uploadSheetMusic,
  deleteSheetMusic,
} from "../services/sheetMusicStorageService";
import { updateSong } from "../services/songsService";

interface SheetMusicUploadProps {
  songId: string;
  bandId: number;
  sheetMusicUrl: string | null | undefined;
  onUpdate: (newUrl: string | null) => void;
}

const Container = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[3]};
  color: ${theme.colors.dark.text.primary};
  font-weight: ${theme.fontWeights.semibold};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const CurrentFile = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[3]};
`;

const FileIcon = styled.div`
  width: 40px;
  height: 40px;
  background: ${theme.colors.semantic.error}20;
  color: ${theme.colors.semantic.error};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
`;

const FileInfo = styled.div`
  flex: 1;
`;

const FileName = styled.div`
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
`;

const FileHint = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.tertiary};
`;

const Actions = styled.div`
  display: flex;
  gap: ${theme.space[2]};
`;

const Button = styled.button<{ $variant?: "primary" | "danger" | "secondary" }>`
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  ${(props) => {
    switch (props.$variant) {
      case "primary":
        return `
          background: ${theme.colors.brand.primary};
          border: none;
          color: white;
          &:hover:not(:disabled) {
            background: ${theme.colors.brand.primaryHover};
          }
        `;
      case "danger":
        return `
          background: transparent;
          border: 1px solid ${theme.colors.semantic.error};
          color: ${theme.colors.semantic.error};
          &:hover:not(:disabled) {
            background: ${theme.colors.semantic.error}20;
          }
        `;
      default:
        return `
          background: ${theme.colors.dark.bg.elevated};
          border: 1px solid ${theme.colors.dark.border.default};
          color: ${theme.colors.dark.text.primary};
          &:hover:not(:disabled) {
            background: ${theme.colors.dark.bg.hover};
            border-color: ${theme.colors.brand.primary};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const UploadZone = styled.label<{ $isDragging: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[6]};
  border: 2px dashed
    ${(props) =>
      props.$isDragging
        ? theme.colors.brand.primary
        : theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  background: ${(props) =>
    props.$isDragging
      ? `${theme.colors.brand.primary}10`
      : theme.colors.dark.bg.tertiary};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    background: ${theme.colors.brand.primary}10;
  }

  input {
    display: none;
  }
`;

const UploadIcon = styled.div`
  font-size: 32px;
  color: ${theme.colors.dark.text.tertiary};
`;

const UploadText = styled.div`
  color: ${theme.colors.dark.text.secondary};
  text-align: center;
`;

const UploadHint = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
`;

const ErrorMessage = styled.div`
  color: ${theme.colors.semantic.error};
  font-size: ${theme.fontSizes.bodySm};
  margin-top: ${theme.space[2]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export default function SheetMusicUpload({
  songId,
  bandId,
  sheetMusicUrl,
  onUpdate,
}: SheetMusicUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      setError(t("sheetMusic.pdfOnly"));
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError(t("sheetMusic.maxSize"));
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const result = await uploadSheetMusic(file, bandId, songId);

      // Update the song with the new sheet music URL
      await updateSong(songId, {
        sheet_music_url: result.path,
      });

      onUpdate(result.path);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(t("sheetMusic.uploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = async () => {
    if (!sheetMusicUrl) return;

    if (!window.confirm(t("sheetMusic.confirmRemove"))) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteSheetMusic(bandId, songId);
      await updateSong(songId, {
        sheet_music_url: null,
        sheet_music_page_timings: null,
      });
      onUpdate(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setError(t("sheetMusic.removeError"));
    } finally {
      setDeleting(false);
    }
  };

  const hasSheetMusic = !!sheetMusicUrl;

  return (
    <Container>
      <Header>
        <i className="bi bi-file-earmark-music" />
        {t("sheetMusic.title")}
      </Header>

      {hasSheetMusic ? (
        <>
          <CurrentFile>
            <FileIcon>
              <i className="bi bi-file-earmark-pdf" />
            </FileIcon>
            <FileInfo>
              <FileName>sheet-music.pdf</FileName>
              <FileHint>{t("sheetMusic.uploadHint")}</FileHint>
            </FileInfo>
            <Actions>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || deleting}
              >
                {uploading ? <Spinner /> : <i className="bi bi-arrow-repeat" />}
                {t("sheetMusic.replace")}
              </Button>
              <Button
                type="button"
                $variant="danger"
                onClick={handleRemove}
                disabled={uploading || deleting}
              >
                {deleting ? <Spinner /> : <i className="bi bi-trash" />}
                {t("sheetMusic.remove")}
              </Button>
            </Actions>
          </CurrentFile>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInputChange}
            style={{ display: "none" }}
          />
        </>
      ) : (
        <UploadZone
          $isDragging={isDragging}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInputChange}
            disabled={uploading}
          />
          <UploadIcon>
            {uploading ? <Spinner /> : <i className="bi bi-cloud-arrow-up" />}
          </UploadIcon>
          <UploadText>
            {uploading
              ? t("sheetMusic.loading")
              : t("sheetMusic.upload")}
          </UploadText>
          <UploadHint>
            {t("sheetMusic.pdfOnly")} • {t("sheetMusic.maxSize")}
          </UploadHint>
        </UploadZone>
      )}

      {error && (
        <ErrorMessage>
          <i className="bi bi-exclamation-triangle" />
          {error}
        </ErrorMessage>
      )}
    </Container>
  );
}
