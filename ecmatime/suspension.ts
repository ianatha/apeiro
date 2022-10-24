export class PristineSignal extends Error {
  constructor() {
    super();
  }
}

export class Suspension extends PristineSignal {
  constructor(public readonly idx: number) {
    super();
  }
}

export function serializeSuspension(e: Suspension) {
  if (e instanceof SuspensionUntilInput) {
    return { until_input: e.serialize() };
  } else {
    return true;
  }
}

export class SuspensionUntilInput extends Suspension {
  constructor(
    private readonly schema: any,
  ) {
    super();
  }

  serialize() {
    return this.schema;
  }
}
