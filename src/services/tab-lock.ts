// Web Locks are released by the browser when a tab closes or crashes. No
// timestamp lease can accidentally leave two writers after a suspended tab.
export async function acquireWriter(key: string): Promise<(() => void) | null> {
  if (!navigator.locks) return null; // Fail closed on unsupported browsers.
  return new Promise((resolve, reject) => {
    navigator.locks
      .request(
        `studyspace:writer:${key}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            resolve(null);
            return;
          }
          await new Promise<void>((release) => resolve(release));
        },
      )
      .catch(reject);
  });
}
