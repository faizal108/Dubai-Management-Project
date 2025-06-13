function createAuditMiddleware(getUserId) {
  return async (params, next) => {
    if (["create", "update"].includes(params.action)) {
      const userId = getUserId();

      if (params.action === "create") {
        params.args.data.createdBy = userId;
        params.args.data.updatedBy = userId;
      }

      if (params.action === "update") {
        params.args.data.updatedBy = userId;
      }
    }

    return next(params);
  };
}

export default { createAuditMiddleware };
