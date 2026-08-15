import { Redirect } from "expo-router";

/** Không để deep link cũ hoặc sai đưa người dùng vào màn hình lỗi mặc định. */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
