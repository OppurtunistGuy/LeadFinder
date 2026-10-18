// An error whose message is safe and useful to show to the user as-is.
export class ScoutError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "ScoutError";
    this.status = status;
  }
}
