const STORAGE_KEY = "selectedBandId";

export const BandStorage = {
  getSelectedBandId(): string | null {
    console.log("get");
    return localStorage.getItem(STORAGE_KEY);
  },
  setSelectedBandId(id: string | number) {
    console.log("set", id);
    localStorage.setItem(STORAGE_KEY, String(id));
  },
  clearSelectedBandId() {
    console.log("clear");
    localStorage.removeItem(STORAGE_KEY);
  },
};
