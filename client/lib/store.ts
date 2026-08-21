import { create } from "zustand";

interface UIState {
  isMobileMenuOpen: boolean;
  searchQuery: string;
  activeNav: string;
  isAuthModalOpen: boolean;
  authModalTab: "signin" | "signup" | "forgot-password" | "phone-setup";
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  setSearchQuery: (query: string) => void;
  setActiveNav: (nav: string) => void;
  openAuthModal: (tab?: "signin" | "signup" | "forgot-password" | "phone-setup") => void;
  closeAuthModal: () => void;
  setAuthModalTab: (tab: "signin" | "signup" | "forgot-password" | "phone-setup") => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMobileMenuOpen: false,
  searchQuery: "",
  activeNav: "Home",
  isAuthModalOpen: false,
  authModalTab: "signin",
  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveNav: (nav) => set({ activeNav: nav }),
  openAuthModal: (tab = "signin") => set({ isAuthModalOpen: true, authModalTab: tab }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  setAuthModalTab: (tab) => set({ authModalTab: tab }),
}));
