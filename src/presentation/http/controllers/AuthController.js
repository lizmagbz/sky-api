export class AuthController {
  constructor({ registerUser, authenticateUser, getAuthenticatedUser, reauthenticateUser }) {
    this.registerUser = registerUser;
    this.authenticateUser = authenticateUser;
    this.getAuthenticatedUser = getAuthenticatedUser;
    this.reauthenticateUser = reauthenticateUser;
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
}
