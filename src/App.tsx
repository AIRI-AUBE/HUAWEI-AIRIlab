import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { TextToImagePage } from './pages/TextToImagePage';
import { ImageToImagePage } from './pages/ImageToImagePage';
import { CreativeRefinementProvider } from './features/creativeRefinement/CreativeRefinementContext';
export default function App() {
    return (
        <CreativeRefinementProvider>
            <Routes>
                <Route element={<AppLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="text-to-image" element={<TextToImagePage />} />
                    <Route path="image-to-image" element={<ImageToImagePage />} />
                </Route>
            </Routes>
        </CreativeRefinementProvider>
    );
}
