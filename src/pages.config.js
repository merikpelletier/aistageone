import Admin from './pages/Admin';
import AssetDetail from './pages/AssetDetail';
import Boutique from './pages/Boutique';
import Catalog from './pages/Catalog';
import Cart from './pages/Cart';
import CartExport from './pages/CartExport';
import Checkout from './pages/Checkout';
import Content from './pages/Content';
import ContentDebug from './pages/ContentDebug';
import DataDebug from './pages/DataDebug';
import Downloads from './pages/Downloads';
import Index from './pages/Index';
import Magazine from './pages/Magazine';
import Plus from './pages/Plus';
import PitchDeckDetail from './pages/PitchDeckDetail';
import PitchDeckEditor from './pages/PitchDeckEditor';
import PitchDecks from './pages/PitchDecks';
import ProductDebug from './pages/ProductDebug';
import ProductDetail from './pages/ProductDetail';
import Quiz from './pages/Quiz';
import Salons from './pages/Salons';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "AssetDetail": AssetDetail,
    "Boutique": Boutique,
    "Catalog": Catalog,
    "Cart": Cart,
    "CartExport": CartExport,
    "Checkout": Checkout,
    "Content": Content,
    "ContentDebug": ContentDebug,
    "DataDebug": DataDebug,
    "Downloads": Downloads,
    "Index": Index,
    "Magazine": Magazine,
    "Plus": Plus,
    "PitchDeckDetail": PitchDeckDetail,
    "PitchDeckEditor": PitchDeckEditor,
    "PitchDecks": PitchDecks,
    "ProductDebug": ProductDebug,
    "ProductDetail": ProductDetail,
    "Quiz": Quiz,
    "Salons": Salons,
}

export const pagesConfig = {
    mainPage: "Index",
    Pages: PAGES,
    Layout: __Layout,
};
