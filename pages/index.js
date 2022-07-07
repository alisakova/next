import Head from 'next/head'
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  const handleClick = (e) => {
    e.preventDefault();
    router.push("/pokemon");
  }
  return (
    <>
      <Head>
        <title>My next.js site</title>
      </Head>
      <div>Welcome to a/b test!</div>
      <button onClick={handleClick}>Click me</button>
    </>
  )
}
