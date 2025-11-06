export class Email {
  private constructor(private readonly _value: string) {}

  static create(raw: string): Email {
    const v = (raw ?? '').trim().toLowerCase();
    if (!v) throw new Error('Email is required');
    // regex decente sin sobre-ingeniería
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!ok) throw new Error('Invalid email');
    return new Email(v);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}
