const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOwnerId = (owner) => (owner._id ? owner._id : owner).toString();

const isOwnerOrCollaborator = (project, userId) => {
  const userIdStr = userId.toString();

  if (getOwnerId(project.owner) === userIdStr) {
    return true;
  }

  return project.collaborators.some((collab) => {
    const collabId = collab._id ? collab._id : collab;
    return collabId.toString() === userIdStr;
  });
};

const isOwner = (project, userId) => getOwnerId(project.owner) === userId.toString();

module.exports = {
  isValidObjectId,
  getOwnerId,
  isOwnerOrCollaborator,
  isOwner,
};
