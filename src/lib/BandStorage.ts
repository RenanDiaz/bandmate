const STORAGE_KEY = "selectedBandId";

export const BandStorage = {
  getSelectedBandId(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
  setSelectedBandId(id: string | number) {
    localStorage.setItem(STORAGE_KEY, String(id));
  },
  clearSelectedBandId() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
