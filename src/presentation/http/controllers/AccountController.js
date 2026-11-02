export class AccountController {
  constructor({ deleteAccount }) {
    this.deleteAccount = deleteAccount;
  }

  remove = async (req, res) => {
    await this.deleteAccount.execute({
      userId: req.userId,
      password: req.body.password,
    });
    res.status(200).json({ status: 'ok' });
  };
}
