export class AuthController {
  constructor({
    registerUser,
    authenticateUser,
    getAuthenticatedUser,
    reauthenticateUser,
    requestPasswordReset,
    verifyRecoveryCode,
    updatePassword,
  }) {
    this.registerUser = registerUser;
    this.authenticateUser = authenticateUser;
    this.getAuthenticatedUser = getAuthenticatedUser;
    this.reauthenticateUser = reauthenticateUser;
    this.requestPasswordReset = requestPasswordReset;
    this.verifyRecoveryCode = verifyRecoveryCode;
    this.updatePassword = updatePassword;
  }

  register = async (req, res) => {
    const user = await this.registerUser.execute(req.body);
    res.status(201).json(user);
  };

  login = async (req, res) => {
    const session = await this.authenticateUser.execute(req.body);
    res.status(200).json(session);
  };

  me = async (req, res) => {
    const user = await this.getAuthenticatedUser.execute({ userId: req.userId });
    res.status(200).json(user);
  };

  reauthenticate = async (req, res) => {
    await this.reauthenticateUser.execute({
      userId: req.userId,
      password: req.body.password,
    });
    res.status(200).json({ status: 'ok' });
  };

  recoverPassword = async (req, res) => {
    await this.requestPasswordReset.execute(req.body);
    res.status(200).json({ status: 'ok' });
  };

  verifyRecovery = async (req, res) => {
    const recovery = await this.verifyRecoveryCode.execute(req.body);
    res.status(200).json(recovery);
  };

  resetPassword = async (req, res) => {
    await this.updatePassword.execute({
      accessToken: req.accessToken,
      password: req.body.password,
    });
    res.status(200).json({ status: 'ok' });
  };
}
