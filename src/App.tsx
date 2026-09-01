import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { TextToImagePage } from './pages/TextToImagePage';
import { ImageToImagePage } from './pages/ImageToImagePage';
export default function App() { return <Routes><Route element={<AppLayout />}><Route index element={<HomePage />} /><Route path="text-to-image" element={<TextToImagePage />} /><Route path="image-to-image" element={<ImageToImagePage />} /></Route></Routes>; }
