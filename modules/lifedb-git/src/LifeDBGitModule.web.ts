// Web fallback - native git not available on web
export default {
  isAvailable(): boolean {
    return false;
  },
  async clone(): Promise<{ success: boolean; error: string }> {
    return { success: false, error: 'Native git not available on web' };
  },
  async pull(): Promise<{ success: boolean; error: string }> {
    return { success: false, error: 'Native git not available on web' };
  },
  async push(): Promise<{ success: boolean; error: string }> {
    return { success: false, error: 'Native git not available on web' };
  },
  async isRepository(): Promise<boolean> {
    return false;
  },
  async status(): Promise<{ success: boolean; error: string }> {
    return { success: false, error: 'Native git not available on web' };
  },
};
