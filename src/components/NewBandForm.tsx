import { useState } from "react";
import type { CreateBandInput } from "../services/bandsService";
import styled from "styled-components";
import { theme } from "../theme";

export const NewBandForm = ({
  onBandCreated,
}: {
  onBandCreated: (input: CreateBandInput) => void;
}) => {
  const [formData, setFormData] = useState<CreateBandInput>({
    name: "",
    genre: "",
    description: "",
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    onBandCreated({
      name: formData.name.trim(),
      genre: formData.genre?.trim() || undefined,
      description: formData.description?.trim() || undefined,
    });

    setFormData({ name: "", genre: "", description: "" });
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <ExpandButton onClick={() => setIsExpanded(true)}>
        <i className="bi bi-plus-circle"></i>
        Create New Band
      </ExpandButton>
    );
  }

  return (
    <FormCard>
      <FormHeader>
        <FormTitle>
          <i className="bi bi-plus-circle"></i>
          Create New Band
        </FormTitle>
        <CloseButton
          onClick={() => setIsExpanded(false)}
          type="button"
          aria-label="Close form"
        >
          <i className="bi bi-x"></i>
        </CloseButton>
      </FormHeader>

      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="newBandName">
            Band Name <Required>*</Required>
          </Label>
          <Input
            id="newBandName"
            placeholder="Enter your band name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="newBandGenre">Genre</Label>
          <Input
            id="newBandGenre"
            placeholder="e.g., Rock, Jazz, Pop, Blues"
            value={formData.genre}
            onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="newBandDescription">Description</Label>
          <TextArea
            id="newBandDescription"
            rows={3}
            placeholder="Tell us about your band..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <HelperText>Optional: Add details about your band's style or mission</HelperText>
        </FormGroup>

        <FormActions>
          <CancelButton type="button" onClick={() => setIsExpanded(false)}>
            Cancel
          </CancelButton>
          <SubmitButton type="submit" disabled={!formData.name.trim()}>
            <i className="bi bi-check-circle"></i>
            Create Band
          </SubmitButton>
        </FormActions>
      </Form>
    </FormCard>
  );
};

// Styled Components

const ExpandButton = styled.button`
  width: 100%;
  background: var(--color-bg-secondary);
  border: 2px dashed var(--color-border);
  color: ${theme.colors.brand.primary};
  padding: ${theme.space[5]} ${theme.space[6]};
  border-radius: ${theme.radius.lg};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.h3};
  }

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
    border-style: solid;
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const FormCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  margin-bottom: ${theme.space[6]};
  box-shadow: var(--shadow-md);
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.space[5]};
  padding-bottom: ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);
`;

const FormTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.h2};
  }
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h2};

  &:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
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
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
`;

const Required = styled.span`
  color: ${theme.colors.semantic.error};
`;

const Input = styled.input`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus) {
    border-color: var(--color-border-strong);
  }
`;

const TextArea = styled.textarea`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};
  resize: vertical;
  min-height: 80px;

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus) {
    border-color: var(--color-border-strong);
  }
`;

const HelperText = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  font-style: italic;
`;

const FormActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[2]};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column-reverse;
  }
`;

const CancelButton = styled.button`
  flex: 1;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const SubmitButton = styled.button`
  flex: 2;
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.bodyLg};
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
    background: var(--color-bg-elevated);
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }
`;
