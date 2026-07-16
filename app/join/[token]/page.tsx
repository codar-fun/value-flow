import JoinInvitation from "./join-invitation";
export const dynamic="force-dynamic";
export default async function JoinPage({params}:{params:Promise<{token:string}>}){const {token}=await params;return <JoinInvitation token={token}/>;}
