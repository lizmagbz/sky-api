export class UserController {
  constructor({ getCurrentProfile, updateCurrentProfile, replaceSchoolLinks, uploadAvatar }) {
    this.getCurrentProfile = getCurrentProfile;
    this.updateCurrentProfile = updateCurrentProfile;
    this.replaceSchoolLinks = replaceSchoolLinks;
    this.uploadAvatar = uploadAvatar;
  }

  show = async (req, res) => {
    const profile = await this.getCurrentProfile.execute({ userId: req.userId });
    res.status(200).json(profile);
  };

  update = async (req, res) => {
    const profile = await this.updateCurrentProfile.execute({
      userId: req.userId,
      accessToken: req.accessToken,
      patch: req.body,
    });
    res.status(200).json(profile);
  };

  replaceSchools = async (req, res) => {
    const profile = await this.replaceSchoolLinks.execute({
      userId: req.userId,
      deleteLinkIds: req.body.deleteLinkIds,
      schoolIds: req.body.schoolIds,
    });
    res.status(200).json(profile);
  };

  upload = async (req, res) => {
    const avatar = await this.uploadAvatar.execute({
      userId: req.userId,
      bytes: req.file?.buffer,
      contentType: req.file?.mimetype,
    });
    res.status(200).json(avatar);
  };
}
