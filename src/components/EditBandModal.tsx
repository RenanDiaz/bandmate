import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
} from "reactstrap";
import type { Band, UpdateBandInput } from "../services/bandsService";

interface Props {
  band: Band | null;
  isOpen: boolean;
  toggle: () => void;
  onSave: (bandId: number, updates: UpdateBandInput) => Promise<void>;
}

export const EditBandModal = ({ band, isOpen, toggle, onSave }: Props) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<UpdateBandInput>({
    name: "",
    genre: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (band) {
      setFormData({
        name: band.name,
        genre: band.genre || "",
        description: band.description || "",
      });
    }
  }, [band]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!band || !formData.name?.trim()) return;

    setIsSaving(true);
    try {
      await onSave(band.id, {
        name: formData.name.trim(),
        genre: formData.genre?.trim() || undefined,
        description: formData.description?.trim() || undefined,
      });
      toggle();
    } catch (error) {
      console.error("Failed to update band:", error);
      alert(t('bands.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>{t('bands.editBand')}</ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <FormGroup>
            <Label for="bandName">{t('bands.bandName')} *</Label>
            <Input
              id="bandName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </FormGroup>
          <FormGroup>
            <Label for="bandGenre">{t('bands.genre')}</Label>
            <Input
              id="bandGenre"
              type="text"
              placeholder={t('bands.placeholders.genre')}
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
            />
          </FormGroup>
          <FormGroup>
            <Label for="bandDescription">{t('bands.description')}</Label>
            <Input
              id="bandDescription"
              type="textarea"
              rows={3}
              placeholder={t('bands.placeholders.description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggle} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button color="primary" type="submit" disabled={isSaving}>
            {isSaving ? t('common.saving') : t('common.saveChanges')}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};
