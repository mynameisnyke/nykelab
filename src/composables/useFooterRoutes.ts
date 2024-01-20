// useFooterRoutes.js


/**
 * Provides route data for the footer.
 * This abstraction simplifies the main component's routing logic.
 *
 * @returns {Array} Array of route objects with path, number, label, and name.
 */

export function useFooterRoutes() {
    return [
      { path: '/', number: '1', label: 'Home', name: 'home' },
      { path: '/arizona', number: '3', label: 'Arizona', name: 'arizona' },
      { path: '/teton', number: '2', label: 'Wyoming', name: 'teton' },
    ];
  }
 
export function useHeaderRoutes() {
    return [
        { path: "/", number: '1', label: "About", name: "about"}
    ]
}