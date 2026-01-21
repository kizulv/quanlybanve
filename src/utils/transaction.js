import mongoose from "mongoose";

export const withTransaction = async (callback) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    // Check for "Transaction numbers are only allowed on a replica set member or mongos" (Code 20)
    const isReplicaSetError =
      error.code === 20 ||
      error.codeName === "IllegalOperation" ||
      (error.message &&
        error.message.includes(
          "Transaction numbers are only allowed on a replica set member",
        ));

    try {
      await session.abortTransaction();
    } catch (ignore) {
      // Ignore errors during abort (e.g., if transaction never started correctly)
    }

    if (isReplicaSetError) {
      console.warn(
        "⚠️ MongoDB Transaction failed (Standalone server detected). Retrying operation without transaction.",
      );
      // Retry the operation without a session
      return await callback(undefined);
    }

    throw error;
  } finally {
    session.endSession();
  }
};
