class EmailProvider {
  constructor(name) {
    this.name = name;
  }

  async send() {
    throw new Error("send() is not implemented");
  }
}

module.exports = EmailProvider;
