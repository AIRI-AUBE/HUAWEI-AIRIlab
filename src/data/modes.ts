export type Mode = {
    id: 'text' | 'image';
    number: string;
    path: string;
    titleKey: string;
    descriptionKey: string;
};
export const defaultModes: Mode[] = [
    {
        id: 'text',
        number: '01',
        path: '/text-to-image',
        titleKey: 'home.cards.text.title',
        descriptionKey: 'home.cards.text.description',
    },
    {
        id: 'image',
        number: '02',
        path: '/image-to-image',
        titleKey: 'home.cards.image.title',
        descriptionKey: 'home.cards.image.description',
    },
];
