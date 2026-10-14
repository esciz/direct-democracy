import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ActionLabel, FactCheckIcon } from "@/components/ui/action-icons";
import { flagPostAsFactualClaim } from "@/lib/truth/claim-flag-actions";

type FactualClaimFlagActionProps = {
  postId: string;
  returnPath: string;
  disabled?: boolean;
  compact?: boolean;
};

export function FactualClaimFlagAction({
  postId,
  returnPath,
  disabled = false,
  compact = false,
}: FactualClaimFlagActionProps) {
  return (
    <form action={flagPostAsFactualClaim}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <FormSubmitButton
        idleLabel={
          <ActionLabel icon={<FactCheckIcon className="h-4 w-4" />}>{disabled ? "Facts submitted" : "Facts"}</ActionLabel>
        }
        pendingLabel={<ActionLabel icon={<FactCheckIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
        disabled={disabled}
        className={
          compact
            ? disabled
              ? "inline-flex min-h-10 items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-3.5 py-2 text-sm font-semibold text-orange-700"
              : "inline-flex min-h-10 items-center justify-center rounded-full border border-orange-200 bg-white px-3.5 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300"
            : disabled
              ? "rounded-full border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700"
              : "rounded-full border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-700 transition hover:border-orange-300"
        }
      />
    </form>
  );
}
