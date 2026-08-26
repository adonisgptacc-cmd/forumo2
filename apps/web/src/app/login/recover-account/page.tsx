import { RecoverAccountForm } from "./recover-account-form";

export default function RecoverAccountPage() {
  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="mb-2 text-xl font-semibold">Set a new password</h1>
      <p className="mb-6 text-sm muted">
        This account was created with Google sign-in, which is no longer
        available. Enter the code we sent to your email to set a password.
      </p>
      <RecoverAccountForm />
    </div>
  );
}
