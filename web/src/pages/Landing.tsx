import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
          Recall
        </h1>
        <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl">
          碎片化知识与灵感的“第二大脑” — ingest chats, exports, and links; we structure the noise.
        </p>
        <div className="mt-5 sm:mt-8 sm:flex sm:justify-center">
          <div className="rounded-md shadow">
            <Link
              to="/login"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10"
            >
              Connect sources
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}