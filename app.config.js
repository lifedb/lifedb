import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    "expo-font",
  ],
  extra: {
    ...config.extra,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
});
