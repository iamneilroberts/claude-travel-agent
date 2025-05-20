from environs import Env


class EnvConfig:
    def __init__(self):
        self.env = Env()
        self.env.read_env()

    @property
    def AWS_ACCESS_KEY_ID(self):
        return self.env("AWS_ACCESS_KEY_ID")

    @property
    def AWS_SECRET_ACCESS_KEY(self):
        return self.env("AWS_SECRET_ACCESS_KEY")

    @property
    def AWS_REGION(self):
        return self.env("AWS_REGION", "us-west-1")


env = EnvConfig()

__all__ = ["env"]
