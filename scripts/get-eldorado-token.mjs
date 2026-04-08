import { Amplify } from "aws-amplify";
import { fetchAuthSession, signIn } from "aws-amplify/auth";

const _pool_id = "us-east-2_MlnzCFgHk";
const _client_id = "1956req5ro9drdtbf5i6kis4la";
const _cognito_hostname = "login.eldorado.gg";
const _eldorado_hostname = "eldorado.gg";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: _pool_id,
      userPoolClientId: _client_id,
      loginWith: {
        oauth: {
          domain: _cognito_hostname,
          redirectSignIn: `https://${_eldorado_hostname}/account/auth-callback`,
          responseType: "code",
        },
      },
    },
  },
});

const username = process.env.ELDO_EMAIL;
const password = process.env.ELDO_PASSWORD;

if (!username || !password) {
  console.error("Missing credentials.");
  console.error("Set env vars then rerun:");
  console.error('  PowerShell: $env:ELDO_EMAIL="you@email"; $env:ELDO_PASSWORD="password"; npm run token');
  process.exit(1);
}

await signIn({ username, password });
const session = await fetchAuthSession();

const idToken = session.tokens?.idToken?.toString?.() ?? "";
const accessToken = session.tokens?.accessToken?.toString?.() ?? "";

if (!idToken) {
  console.error("Login succeeded but IdToken was empty. (Account may require MFA or other challenge.)");
  process.exit(2);
}

console.log("ID_TOKEN:");
console.log(idToken);
console.log("");
console.log("ACCESS_TOKEN:");
console.log(accessToken);

