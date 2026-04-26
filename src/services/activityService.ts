// This file is deprecated. FocusSync now logs activities directly to MongoDB.
export const logActivity = async () => {
  throw new Error("logActivity is deprecated. Use the useActivities hook which writes directly to the cloud.");
};
