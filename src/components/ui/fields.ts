import { theme } from "../../theme";

/**
 * Add to any text field or select styled under 16px. iOS zooms the page into
 * a field below 16px when it gets focus; on touch screens it gets 16px,
 * with a mouse it keeps its compact size.
 */
export const noIosZoom = `
  @media (pointer: coarse) {
    font-size: ${theme.fontSizes.body};
  }
`;
