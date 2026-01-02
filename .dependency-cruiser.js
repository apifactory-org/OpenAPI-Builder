// .dependency-cruiser.js
module.exports = {
  forbidden: [
    {
      name: "domain-no-interface",
      comment: "Domain no debe depender de Interface",
      from: { path: "^bin/domain" },
      to: { path: "^bin/interface" },
    },
    {
      name: "domain-no-infrastructure",
      comment: "Domain no debe depender de Infrastructure",
      from: { path: "^bin/domain" },
      to: { path: "^bin/infrastructure" },
    },
    {
      name: "application-no-interface",
      comment: "Application no debe depender de Interface",
      from: { path: "^bin/application" },
      to: { path: "^bin/interface" },
    },
    {
      name: "application-no-infrastructure",
      comment: "Application no debe depender de Infrastructure (preferir ports)",
      from: { path: "^bin/application" },
      to: { path: "^bin/infrastructure" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: false,
    combinedDependencies: false,
    preserveSymlinks: false,
  },
};
