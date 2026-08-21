import { SetMetadata } from "@nestjs/common";

export const SKIP_TOS_CHECK = "skipTosCheck";
export const SkipTosCheck = () => SetMetadata(SKIP_TOS_CHECK, true);
