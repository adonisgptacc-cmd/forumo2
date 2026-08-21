"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../lib/use-api-client";
import { Button } from "@forumo/design-system";

interface PlaceBidFormProps {
  auctionId: string;
  minBidCents: number;
}

interface BidFormData {
  amount: number;
}

export function PlaceBidForm({ auctionId, minBidCents }: PlaceBidFormProps) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BidFormData>();

  const mutation = useMutation({
    mutationFn: async (data: BidFormData) => {
      // Amount in dollars to cents
      const amountCents = Math.round(data.amount * 100);
      return api.auctions.placeBid(auctionId, { amountCents });
    },
    onSuccess: () => {
      reset();
      // Invalidate queries if needed, though socket should update UI
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
    },
  });

  const onSubmit = (data: BidFormData) => {
    mutation.mutate(data);
  };

  const minBidDollars = minBidCents / 100;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 p-4 border rounded-lg bg-white shadow-sm"
    >
      <h3 className="text-lg font-semibold">Place a Bid</h3>
      <div className="flex flex-col space-y-2">
        <label htmlFor="amount" className="text-sm font-medium text-gray-700">
          Your Max Bid ($)
        </label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min={minBidDollars}
          placeholder={`Min $${minBidDollars.toFixed(2)}`}
          {...register("amount", {
            required: true,
            min: {
              value: minBidDollars,
              message: `Minimum bid is $${minBidDollars.toFixed(2)}`,
            },
          })}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.amount && (
          <span className="text-red-500 text-sm">{errors.amount.message}</span>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        isLoading={mutation.isPending}
        disabled={mutation.isPending}
      >
        Place Bid
      </Button>
      {mutation.isError && (
        <p className="text-red-500 text-sm mt-2">
          Error placing bid. Try again.
        </p>
      )}
    </form>
  );
}
