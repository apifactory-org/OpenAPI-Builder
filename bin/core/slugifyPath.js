// bin/core/slugifyPath.js

/**
 * Convierte una ruta OAS3 (ej. '/users/{id}') en un nombre de archivo
 * seguro (ej. 'users-id.yaml').
 *
 * @param {string} routePath - La ruta OAS3 (key en `paths`).
 * @returns {string} - Nombre de archivo YAML asociado a esa ruta.
 */
function slugifyPath(routePath) {
  // Reemplaza barras por guiones
  let slug = routePath.replace(/\//g, '-');
  // Elimina { } y guion inicial
  slug = slug.replace(/[{}]/g, '').replace(/^-/, '');
  // Para la ruta '/'
  if (slug === '') return 'root.yaml';
  return `${slug}.yaml`;
}

module.exports = { slugifyPath };
