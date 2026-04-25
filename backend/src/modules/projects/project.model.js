const mongoose = require("mongoose");

/**
 * Resolves the Project model registered by `modules/index.js`.
 * Do not register a second "Project" schema here.
 */
function getProjectModel() {
  const M = mongoose.models.Project;
  if (!M) {
    throw new Error("Project model is not registered yet. Ensure ./modules is loaded first.");
  }
  return M;
}

module.exports = { getProjectModel };
