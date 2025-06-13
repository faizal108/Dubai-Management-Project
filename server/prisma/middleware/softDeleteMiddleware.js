const softDeleteMiddleware = async (params, next) => {
  const softDeleteModels = ["Donor", "Donation"];

  if (softDeleteModels.includes(params.model)) {
    if (
      params.action === "findMany" ||
      params.action === "findFirst" ||
      params.action === "findUnique"
    ) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.isDeleted = false;
    }

    if (params.action === "delete") {
      params.action = "update";
      params.args.data = { isDeleted: true };
    }

    if (params.action === "deleteMany") {
      params.action = "updateMany";
      params.args.data = { isDeleted: true };
    }
  }

  return next(params);
};

export default { softDeleteMiddleware };
