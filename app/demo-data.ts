// Domain types shared across the app. (The former demo data set — members,
// circles, transactions, etc. — was removed when loop-backend became the data
// source; only these type definitions remain.)

export type AvatarVariant = "crop" | "wave" | "cap" | "bob" | "spike" | "curl" | "bun" | "leaf";
export type Color = "yellow" | "pink" | "blue" | "green" | "coral";

export type Member = {
  id: string;
  name: string;
  initial: string;
  role: string;
  color: Color;
  avatar: AvatarVariant;
  bio: string;
  wechat: string;
  circleIds: string[];
};

export type Circle = {
  id: string;
  name: string;
  short: string;
  color: Color;
  currency: string;
  members: number;
  role: string;
  location: string;
  tagline: string;
  intro: string;
  scene: string;
  joining: string;
  invitation: string;
  principles: string[];
  rules: string[];
  references: { name: string; value: string; note: string }[];
  memberIds: string[];
};

export type CircleAccount = {
  memberId: string;
  circleId: string;
  balance: number;
  given: number;
  received: number;
};

export type Listing = {
  id: string;
  memberId: string;
  type: "need" | "offer";
  title: string;
  detail: string;
  circleIds: string[];
  visibility: "circle" | "cross-circle";
  location: string;
  time: string;
  reference: string;
  tags: string[];
  status: "active" | "paused" | "closed";
  createdAt: string;
  nearby?: boolean;
};

export type GoodCard = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  story: string;
  date: string;
  tags: string[];
  visibility: "cross-circle" | "hidden";
  circleId: string;
};

export type Transaction = {
  id: string;
  circleId: string;
  providerId: string;
  receiverId: string;
  amount: number;
  title: string;
  story: string;
  happenedAt: string;
  recordedAt: string;
  visibility: "public" | "mystery" | "private";
  status: "confirmed" | "corrected" | "rejected";
  tags: string[];
};

export type ActivityReference = {
  id: number;
  source: "listing" | "card" | "transaction";
  sourceId: string;
};
