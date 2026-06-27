import { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";
import { uploadSheetMusic, deleteSheetMusicFile, getSheetMusicUrl } from "../services/sheetMusicStorageService";
import {
  getSheetMusicForSong,
  createSheetMusic,
  updateSheetMusic,
  updateSheetMusicPageTimings,
  deleteSheetMusic,
  getInstrumentIcon,
  INSTRUMENT_OPTIONS,
  type SheetMusic,
} from "../services/songSheetMusicService";
import PageTimingSyncModal from "./PageTimingSyncModal";
import { ConfirmModal } from "./ConfirmModal";
import type { PageTiming } from "../services/songsService";

interface SheetMusicUploadProps {
  songId: string;
  bandId: number;
  backingTrackUrl?: string;
  onUpdate?: () => void;
}

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  action: () => Promise<void>;
};

const Container = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.space[3]};
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: ${theme.colors.dark.text.primary};
  font-weight: ${theme.fontWeights.semibold};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const AddButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.brand.primaryHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SheetMusicList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const SheetMusicItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.dark.border.strong};
  }
`;

const ItemIcon = styled.div<{ $color?: string }>`
  width: 40px;
  height: 40px;
  background: ${({ $color }) => $color || theme.colors.brand.primary}20;
  color: ${({ $color }) => $color || theme.colors.brand.primary};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h4};
  flex-shrink: 0;
`;

const ItemInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemName = styled.div`
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemMeta = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.tertiary};
`;

const ItemActions = styled.div`
  display: flex;
  gap: ${theme.space[1]};
`;

const IconButton = styled.button<{ $variant?: "danger" }>`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${({ $variant }) =>
    $variant === "danger" ? theme.colors.semantic.error : theme.colors.dark.text.secondary};
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${({ $variant }) =>
      $variant === "danger" ? `${theme.colors.semantic.error}20` : theme.colors.dark.bg.elevated};
    border-color: ${({ $variant }) =>
      $variant === "danger" ? theme.colors.semantic.error : theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[6]};
  color: ${theme.colors.dark.text.tertiary};

  i {
    font-size: 32px;
    margin-bottom: ${theme.space[2]};
    display: block;
  }
`;

const UploadModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${theme.zIndex.modal};
  padding: ${theme.space[4]};
`;

const ModalContent = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: ${theme.fontSizes.h4};
  color: ${theme.colors.dark.text.primary};
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.secondary};
  font-size: ${theme.fontSizes.h3};
  cursor: pointer;
  padding: ${theme.space[1]};
  line-height: 1;

  &:hover {
    color: ${theme.colors.dark.text.primary};
  }
`;

const ModalBody = styled.div`
  padding: ${theme.space[4]};
`;

const FormGroup = styled.div`
  margin-bottom: ${theme.space[4]};
`;

const Label = styled.label`
  display: block;
  margin-bottom: ${theme.space[2]};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
`;

const Input = styled.input`
  width: 100%;
  padding: ${theme.space[3]};
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  color: ${theme.colors.dark.text.primary};
  font-size: ${theme.fontSizes.body};

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
  }

  &::placeholder {
    color: ${theme.colors.dark.text.disabled};
  }
`;

const Select = styled.select`
  width: 100%;
  padding: ${theme.space[3]};
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  color: ${theme.colors.dark.text.primary};
  font-size: ${theme.fontSizes.body};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
  }
`;

const UploadZone = styled.label<{ $isDragging: boolean; $hasFile: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[6]};
  border: 2px dashed
    ${({ $isDragging, $hasFile }) =>
      $hasFile
        ? theme.colors.semantic.success
        : $isDragging
        ? theme.colors.brand.primary
        : theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  background: ${({ $isDragging, $hasFile }) =>
    $hasFile
      ? `${theme.colors.semantic.success}10`
      : $isDragging
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

const UploadIcon = styled.div<{ $hasFile: boolean }>`
  font-size: 32px;
  color: ${({ $hasFile }) =>
    $hasFile ? theme.colors.semantic.success : theme.colors.dark.text.tertiary};
`;

const UploadText = styled.div`
  color: ${theme.colors.dark.text.secondary};
  text-align: center;
`;

const FileName = styled.div`
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.semantic.success};
`;

const UploadHint = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${theme.space[2]};
  padding: ${theme.space[4]};
  border-top: 1px solid ${theme.colors.dark.border.default};
`;

const Button = styled.button<{ $variant?: "primary" | "secondary" }>`
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  ${({ $variant }) =>
    $variant === "primary"
      ? `
    background: ${theme.colors.brand.primary};
    border: none;
    color: white;
    &:hover:not(:disabled) {
      background: ${theme.colors.brand.primaryHover};
    }
  `
      : `
    background: transparent;
    border: 1px solid ${theme.colors.dark.border.default};
    color: ${theme.colors.dark.text.primary};
    &:hover:not(:disabled) {
      background: ${theme.colors.dark.bg.elevated};
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
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

const ErrorMessage = styled.div`
  color: ${theme.colors.semantic.error};
  font-size: ${theme.fontSizes.bodySm};
  margin-top: ${theme.space[2]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

export default function SheetMusicUpload({
  songId,
  bandId,
  backingTrackUrl,
  onUpdate,
}: SheetMusicUploadProps) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [sheetMusicList, setSheetMusicList] = useState<SheetMusic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal form state
  const [name, setName] = useState("");
  const [instrument, setInstrument] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timing sync modal state
  const [showTimingModal, setShowTimingModal] = useState(false);
  const [timingSheetMusic, setTimingSheetMusic] = useState<SheetMusic | null>(null);
  const [timingPdfUrl, setTimingPdfUrl] = useState<string | null>(null);

  // Load sheet music list
  useEffect(() => {
    loadSheetMusic();
  }, [songId]);

  const loadSheetMusic = async () => {
    try {
      setLoading(true);
      const list = await getSheetMusicForSong(songId);
      setSheetMusicList(list);
    } catch (err) {
      console.error("Failed to load sheet music:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setName("");
    setInstrument("");
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openModal = () => {
    resetModal();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetModal();
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== "application/pdf") {
      setError(t("sheetMusic.pdfOnly"));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError(t("sheetMusic.maxSize"));
      return;
    }
    setError(null);
    setSelectedFile(file);

    // Auto-fill name from filename if empty
    if (!name) {
      const fileName = file.name.replace(/\.pdf$/i, "");
      setName(fileName);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) return;

    setUploading(true);
    setError(null);

    try {
      // Create the database entry first to get the ID
      const sheetMusicEntry = await createSheetMusic({
        song_id: songId,
        name: name.trim(),
        instrument: instrument || undefined,
        file_url: "", // Will be updated after upload
      });

      // Upload the file
      const result = await uploadSheetMusic(
        selectedFile,
        bandId,
        songId,
        sheetMusicEntry.id
      );

      // Update the entry with the file path
      await updateSheetMusic(sheetMusicEntry.id, {
        file_url: result.path,
      });

      // Reload the list
      await loadSheetMusic();
      closeModal();
      onUpdate?.();
    } catch (err) {
      console.error("Upload failed:", err);
      setError(t("sheetMusic.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.action();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const handleDelete = async (sheetMusic: SheetMusic) => {
    setConfirm({
      title: t("sheetMusic.remove"),
      message: t("sheetMusic.confirmRemove"),
      confirmLabel: t("sheetMusic.remove"),
      tone: "danger",
      action: async () => {
        setDeleting(sheetMusic.id);

        try {
          // Delete the file from storage
          await deleteSheetMusicFile(sheetMusic.file_url);
          // Delete the database entry
          await deleteSheetMusic(sheetMusic.id);
          // Reload the list
          await loadSheetMusic();
          onUpdate?.();
        } catch (err) {
          console.error("Delete failed:", err);
          setError(t("sheetMusic.removeError"));
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  const getInstrumentColor = (inst?: string): string => {
    const colors: Record<string, string> = {
      guitar: "#F59E0B",
      bass: "#8B5CF6",
      drums: "#EF4444",
      piano: "#10B981",
      vocals: "#06B6D4",
      brass: "#F97316",
      strings: "#EC4899",
      full: "#6366F1",
    };
    return colors[inst || ""] || theme.colors.brand.primary;
  };

  const openTimingModal = async (sheetMusic: SheetMusic) => {
    try {
      // Get signed URL for the PDF
      const url = await getSheetMusicUrl(sheetMusic.file_url);
      setTimingPdfUrl(url);
      setTimingSheetMusic(sheetMusic);
      setShowTimingModal(true);
    } catch (err) {
      console.error("Failed to load PDF URL:", err);
      setError(t("sheetMusic.loadError"));
    }
  };

  const closeTimingModal = () => {
    setShowTimingModal(false);
    setTimingSheetMusic(null);
    setTimingPdfUrl(null);
  };

  const handleSaveTimings = async (timings: PageTiming[]) => {
    if (!timingSheetMusic) return;

    try {
      await updateSheetMusicPageTimings(timingSheetMusic.id, timings);
      await loadSheetMusic();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to save timings:", err);
      setError(t("sheetMusic.saveError", "Failed to save timings"));
    }
  };

  return (
    <Container>
      <Header>
        <Title>
          <i className="bi bi-file-earmark-music" />
          {t("sheetMusic.title")}
        </Title>
        <AddButton type="button" onClick={openModal}>
          <i className="bi bi-plus-lg" />
          {t("sheetMusic.upload")}
        </AddButton>
      </Header>

      {loading ? (
        <EmptyState>
          <Spinner />
        </EmptyState>
      ) : sheetMusicList.length === 0 ? (
        <EmptyState>
          <i className="bi bi-file-earmark-music" />
          <div>{t("sheetMusic.uploadHint")}</div>
        </EmptyState>
      ) : (
        <SheetMusicList>
          {sheetMusicList.map((item) => (
            <SheetMusicItem key={item.id}>
              <ItemIcon $color={getInstrumentColor(item.instrument)}>
                <i className={getInstrumentIcon(item.instrument)} />
              </ItemIcon>
              <ItemInfo>
                <ItemName>{item.name}</ItemName>
                <ItemMeta>
                  {item.instrument &&
                    INSTRUMENT_OPTIONS.find((o) => o.value === item.instrument)?.label}
                  {item.page_timings.length > 0 && (
                    <> • {item.page_timings.length} {t("sheetMusic.pageTimings").toLowerCase()}</>
                  )}
                </ItemMeta>
              </ItemInfo>
              <ItemActions>
                <IconButton
                  type="button"
                  onClick={() => openTimingModal(item)}
                  title={t("sheetMusic.syncTimings", "Sync page timings")}
                >
                  <i className="bi bi-clock-history" />
                </IconButton>
                <IconButton
                  type="button"
                  onClick={() => handleDelete(item)}
                  $variant="danger"
                  disabled={deleting === item.id}
                  title={t("sheetMusic.remove")}
                >
                  {deleting === item.id ? <Spinner /> : <i className="bi bi-trash" />}
                </IconButton>
              </ItemActions>
            </SheetMusicItem>
          ))}
        </SheetMusicList>
      )}

      {error && (
        <ErrorMessage>
          <i className="bi bi-exclamation-triangle" />
          {error}
        </ErrorMessage>
      )}

      {/* Upload Modal */}
      {showModal && (
        <UploadModal onClick={closeModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{t("sheetMusic.upload")}</ModalTitle>
              <CloseButton type="button" onClick={closeModal}>
                <i className="bi bi-x" />
              </CloseButton>
            </ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>{t("sheetMusic.name", "Name")} *</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("sheetMusic.namePlaceholder", "e.g., Guitar, Lead Sheet")}
                  autoFocus
                />
              </FormGroup>

              <FormGroup>
                <Label>{t("sheetMusic.instrument", "Instrument")}</Label>
                <Select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                >
                  <option value="">{t("sheetMusic.selectInstrument", "Select instrument (optional)")}</option>
                  {INSTRUMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>{t("sheetMusic.file", "PDF File")} *</Label>
                <UploadZone
                  $isDragging={isDragging}
                  $hasFile={!!selectedFile}
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleInputChange}
                  />
                  <UploadIcon $hasFile={!!selectedFile}>
                    <i className={selectedFile ? "bi bi-check-circle-fill" : "bi bi-cloud-arrow-up"} />
                  </UploadIcon>
                  {selectedFile ? (
                    <FileName>{selectedFile.name}</FileName>
                  ) : (
                    <UploadText>{t("sheetMusic.dropOrClick", "Drop PDF here or click to select")}</UploadText>
                  )}
                  <UploadHint>
                    {t("sheetMusic.pdfOnly")} • {t("sheetMusic.maxSize")}
                  </UploadHint>
                </UploadZone>
              </FormGroup>

              {error && (
                <ErrorMessage>
                  <i className="bi bi-exclamation-triangle" />
                  {error}
                </ErrorMessage>
              )}
            </ModalBody>
            <ModalFooter>
              <Button type="button" onClick={closeModal} disabled={uploading}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                $variant="primary"
                onClick={handleUpload}
                disabled={!selectedFile || !name.trim() || uploading}
              >
                {uploading ? (
                  <>
                    <Spinner />
                    {t("sheetMusic.uploading", "Uploading...")}
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up" />
                    {t("sheetMusic.upload")}
                  </>
                )}
              </Button>
            </ModalFooter>
          </ModalContent>
        </UploadModal>
      )}

      {/* Page Timing Sync Modal */}
      {timingSheetMusic && timingPdfUrl && (
        <PageTimingSyncModal
          isOpen={showTimingModal}
          onClose={closeTimingModal}
          pdfUrl={timingPdfUrl}
          audioUrl={backingTrackUrl}
          initialTimings={timingSheetMusic.page_timings}
          onSave={handleSaveTimings}
          sheetMusicName={timingSheetMusic.name}
        />
      )}

      <ConfirmModal
        isOpen={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone ?? "danger"}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </Container>
  );
}
