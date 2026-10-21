import type { FormEvent } from "react";

/**
 * onSubmit handler that hands the form's FormData (including the clicked
 * submit button's name/value) to `handler`, instead of `<form action>`.
 * React 19 resets a `<form action>` after every run — even when the action
 * caught an error and showed it — which silently wipes what the user typed
 * (e.g. a disposition's Status after a "comments required" error).
 */
export function submitFormData(handler: (formData: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    handler(new FormData(e.currentTarget, submitter));
  };
}
