"use client";

import React, { createContext, useContext, useState } from "react";

// Define all translations
export const translations = {
  en: {
    // Navbar
    nav: {
      features: "Features",
      pricing: "Pricing",
      faq: "FAQ",
      login: "Login",
      signUp: "Sign Up",
      signOut: "Sign Out",
    },
    // Hero Section
    hero: {
      badge: "AI-Powered Automation",
      headline1: "Create Viral Short Videos",
      headline2: "in Seconds",
      subheadline: "Automate your faceless channels on TikTok and Instagram. Generate engaging scripts, visuals, and voiceovers with just one click.",
      cta: "Generate Video",
      demo: "Watch Demo",
    },
    // Form
    form: {
      title: "Configure Your Video",
      subtitle: "Choose a viral topic or write your own.",
      videoType: "Video Type",
      gameplay: "Background video + AI Voice",
      gameplayDesc: "Background video with AI-generated voiceover",
      aiImages: "Fully AI Video",
      aiImagesDesc: "Complete AI-generated video with visuals and voice",
      voiceLanguage: "Voice Language",
      narratorVoice: "Narrator Voice",
      artStyle: "Art Style",
      category: "Viral Category",
      duration: "Duration",
      script: "Video Script",
      scriptPlaceholder: "Enter your script here or generate one...",
      generateAI: "Generate with AI",
      createVideo: "Create Video",
      generating: "Generating Magic...",
      generateAnother: "Generate Another",
      download: "Download",
      mockMode: "Use Mock Data (Skip API calls)",
      mockPlaceholder: '{"audioUrl": "...", "subtitles": "...", "generatedImages": [...], ...}',
      clearMock: "Clear Mock Data",
      pasteJson: "Paste Edge Function response JSON here:",
      close: "Close",
      upgradePlan: "Upgrade Plan",
      customPrompt: "Custom Prompt (optional)",
      customPromptPlaceholder: "Add specific details for your video...",
    },
    // Steps
    steps: {
      videoType: "Video Type",
      categoryDuration: "Category & Duration",
      voiceSettings: "Voice Settings",
      artStyle: "Art Style",
      script: "Script",
      stepOf: "Step {current} of {total}",
      back: "Back",
      next: "Next",
      selectVideoType: "Select Video Type",
      selectVideoTypeDesc: "Choose how your video visuals will be generated",
      chooseCategoryDuration: "Category & Duration",
      chooseCategoryDurationDesc: "Select a viral category and video length",
      chooseVoice: "Voice Settings",
      chooseVoiceDesc: "Select the language and narrator voice",
      chooseArtStyle: "Art Style",
      chooseArtStyleDesc: "Choose the visual style for your AI-generated images",
      writeScript: "Write Your Script",
      writeScriptDesc: "Enter your script or generate one with AI",
      videoReady: "Your Video is Ready!",
      videoReadyDesc: "Preview your video and download it",
      monetizable: "TikTok",
      monetizableHint: "Videos 60s+ can be monetized on TikTok",
    },
    // Pricing Page
    pricing: {
      title: "Simple, Transparent Pricing",
      subtitle: "Choose the plan that fits your needs. All plans include our core features.",
      mostPopular: "Most Popular",
      perMonth: "/month",
      getStarted: "Get Started",
      common: {
        feature1: "Full content creation",
        feature2: "Different Art Styles",
        feature3: "Custom AI voice over",
        feature4: "No watermark",
      },
      starter: {
        name: "Starter",
        description: "Perfect for creators getting started with consistent content.",
        feature1: "12 videos per month (3 posts per week)",
      },
      professional: {
        name: "Professional",
        description: "Ideal for daily content creators who want to grow fast.",
        feature1: "30 videos per month (1 post per day)",
      },
      elite: {
        name: "Elite",
        description: "For serious creators and agencies posting multiple times daily.",
        feature1: "60 videos per month (2 posts per day)",
      },
    },
    // Categories
    categories: {
      joke: "Funny Joke",
      motivational: "Daily Motivation",
      scary: "Scary Story",
      history: "History Facts",
      reddit: "Reddit Story",
      "reddit-relationship": "Reddit Relationship",
    },
    // Art Styles
    artStyles: {
      cartoon: "Cartoon",
      horror: "Horror",
      realistic: "Realistic",
      anime: "Anime",
      ghibli: "Ghibli",
    },
    // Durations
    durations: {
      "30": "Short",
      "70": "Long",
    },
    // Footer
    footer: {
      copyright: "© {{year}} Viral Faceless Reels. All rights reserved.",
    },
    // Why Choose Us Section
    whyChooseUs: {
      title: "Why Choose Us?",
      subtitle: "Start building your passive income stream today with AI-powered video creation",
      card1: {
        title: "No Face Required",
        description: "Create engaging content without showing your face. Perfect for introverts or anyone who wants privacy while building their brand.",
      },
      card2: {
        title: "No Video Editors Needed",
        description: "Skip expensive video editors. Our AI handles everything from script to final video, saving you hundreds of dollars monthly.",
      },
      card3: {
        title: "Hours to Minutes",
        description: "What used to take hours of editing, recording, and production now takes just a couple of minutes. Focus on scaling, not creating.",
      },
      card4: {
        title: "Passive Income Ready",
        description: "Generate unlimited content for TikTok, Instagram, and YouTube. Build multiple revenue streams while you sleep.",
      },
    },
    // Reviews Section
    reviews: {
      title: "What Our Users Say",
      subtitle: "Join thousands of creators building passive income with AI-powered videos",
    },
    // AI Providers Section
    aiProviders: {
      title: "Powered by the best AI providers",
      subtitle: "Leveraging cutting-edge AI technology from industry leaders",
    },
    // FAQ Section
    faq: {
      title: "Frequently Asked Questions",
      subtitle: "Everything you need to know about our platform",
      questions: [
        {
          question: "How does the AI video generation work?",
          answer: "Our platform uses advanced AI models to generate scripts, create visuals, and produce natural-sounding voiceovers. Simply choose your settings, and our AI handles the entire video creation process automatically.",
        },
        {
          question: "Do I need any video editing experience?",
          answer: "Not at all! Our platform is designed for everyone, regardless of technical skills. The AI handles all the complex editing, so you can focus on creating content and growing your audience.",
        },
        {
          question: "Can I monetize the videos I create?",
          answer: "Yes! All videos created with our platform are yours to use commercially. You can monetize them on TikTok, YouTube, Instagram, and any other platform you choose.",
        },
        {
          question: "How long does it take to generate a video?",
          answer: "Most videos are generated in 3-5 minutes, depending on the length and complexity.",
        },
        {
          question: "What languages are supported?",
          answer: "We support 25+ languages including English, Spanish, French, German, Portuguese, and many more. You can create content for global audiences with natural-sounding voiceovers in each language.",
        },
        {
          question: "Can I cancel my subscription anytime?",
          answer: "Yes, you can cancel your subscription at any time. There are no long-term commitments or cancellation fees. Your subscription will remain active until the end of your billing period. To cancel your subscription, you can access the subscriptions area, click to change plan and cancel the subscription.",
        },
      ],
    },
    // Language Names
    languages: {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      pt: "Portuguese",
      it: "Italian",
      nl: "Dutch",
      pl: "Polish",
      ru: "Russian",
      zh: "Chinese",
      ja: "Japanese",
      ko: "Korean",
      ar: "Arabic",
      hi: "Hindi",
      tr: "Turkish",
      sv: "Swedish",
      da: "Danish",
      no: "Norwegian",
      fi: "Finnish",
      id: "Indonesian",
      vi: "Vietnamese",
      th: "Thai",
      uk: "Ukrainian",
      cs: "Czech",
      ro: "Romanian",
    },
    // Messages
    messages: {
      signInRequired: "Please sign in to generate videos!",
      scriptRequired: "Please generate or write a script first!",
      voicePreviewError: 'Voice preview for "{{voice}}" in {{language}} not found. Please generate voice samples first.',
    },
    // Errors
    errors: {
      insufficientCredits: {
        title: "Insufficient Credits",
        message: "You don't have enough credits to generate this video. Please upgrade your plan or wait for your credits to refresh.",
      },
      generic: {
        title: "Something went wrong",
        message: "An error occurred while generating your video. Please try again.",
      },
    },
    // Dashboard
    dashboard: {
      menu: {
        videoCreation: "Video Creation",
        socialMedia: "Link Social Media",
      },
       socialMedia: {
         title: "Link Your Social Media Accounts",
         subtitle: "Connect your accounts to automatically upload videos",
         connect: "Connect",
         disconnect: "Disconnect",
         connected: "Connected",
         notConnected: "Not connected",
         connecting: "Connecting...",
         disconnecting: "Disconnecting...",
         description: "Connect your social media accounts to automatically upload your generated videos. This feature will be available soon.",
         disconnectConfirm: "Are you sure you want to disconnect {platform}?",
         connectSuccess: "Successfully connected to {platform}!",
         disconnectSuccess: "Successfully disconnected from {platform}",
         connectError: "Failed to connect to {platform}",
         disconnectError: "Failed to disconnect from {platform}",
       },
    },
  },
  es: {
    nav: {
      features: "Características",
      pricing: "Precios",
      faq: "Preguntas Frecuentes",
      login: "Iniciar sesión",
      signUp: "Registrarse",
      signOut: "Cerrar sesión",
    },
    hero: {
      badge: "Automatización con IA",
      headline1: "Crea Videos Virales Cortos",
      headline2: "en Segundos",
      subheadline: "Automatiza tus canales sin rostro en TikTok e Instagram. Genera guiones atractivos, visuales y voces con un solo clic.",
      cta: "Generar Video",
      demo: "Ver Demo",
    },
    form: {
      title: "Configura tu Video",
      subtitle: "Elige un tema viral o escribe el tuyo.",
      videoType: "Tipo de Video",
      gameplay: "Video de Fondo + Voz IA",
      gameplayDesc: "Video de fondo con voz generada por IA",
      aiImages: "Video Completamente IA",
      aiImagesDesc: "Video completamente generado por IA con visuales y voz",
      voiceLanguage: "Idioma de Voz",
      narratorVoice: "Voz del Narrador",
      artStyle: "Estilo de Arte",
      category: "Categoría Viral",
      duration: "Duración",
      script: "Guión del Video",
      scriptPlaceholder: "Ingresa tu guión aquí o genera uno...",
      generateAI: "Generar con IA",
      createVideo: "Crear Video",
      generating: "Generando Magia...",
      generateAnother: "Generar Otro",
      download: "Descargar",
      mockMode: "Usar Datos de Prueba (Omitir llamadas API)",
      mockPlaceholder: '{"audioUrl": "...", "subtitles": "...", "generatedImages": [...], ...}',
      clearMock: "Limpiar Datos de Prueba",
      pasteJson: "Pega aquí la respuesta JSON de Edge Function:",
      close: "Cerrar",
      upgradePlan: "Mejorar Plan",
      customPrompt: "Indicación personalizada (opcional)",
      customPromptPlaceholder: "Agrega detalles específicos para tu video...",
    },
    steps: {
      videoType: "Tipo de Video",
      categoryDuration: "Categoría y Duración",
      voiceSettings: "Configuración de Voz",
      artStyle: "Estilo de Arte",
      script: "Guión",
      stepOf: "Paso {current} de {total}",
      back: "Atrás",
      next: "Siguiente",
      selectVideoType: "Selecciona el Tipo de Video",
      selectVideoTypeDesc: "Elige cómo se generarán los visuales de tu video",
      chooseCategoryDuration: "Categoría y Duración",
      chooseCategoryDurationDesc: "Selecciona una categoría viral y la duración del video",
      chooseVoice: "Configuración de Voz",
      chooseVoiceDesc: "Selecciona el idioma y la voz del narrador",
      chooseArtStyle: "Estilo de Arte",
      chooseArtStyleDesc: "Elige el estilo visual para tus imágenes generadas por IA",
      writeScript: "Escribe tu Guión",
      writeScriptDesc: "Ingresa tu guión o genera uno con IA",
      videoReady: "¡Tu Video está Listo!",
      videoReadyDesc: "Previsualiza tu video y descárgalo",
      monetizable: "TikTok",
      monetizableHint: "Videos de 60s+ pueden monetizarse en TikTok",
    },
    pricing: {
      title: "Precios Simples y Transparentes",
      subtitle: "Elige el plan que se adapte a tus necesidades. Todos los planes incluyen nuestras funciones principales.",
      mostPopular: "Más Popular",
      perMonth: "/mes",
      getStarted: "Comenzar",
      common: {
        feature1: "Creación de contenido completa",
        feature2: "Diferentes estilos artísticos",
        feature3: "Voz AI personalizada",
        feature4: "Sin marca de agua",
      },
      starter: {
        name: "Inicial",
        description: "Perfecto para creadores que comienzan con contenido consistente.",
        feature1: "12 videos por mes (3 publicaciones por semana)",
      },
      professional: {
        name: "Profesional",
        description: "Ideal para creadores de contenido diario que quieren crecer rápido.",
        feature1: "30 videos por mes (1 publicación por día)",
      },
      elite: {
        name: "Elite",
        description: "Para creadores serios y agencias que publican varias veces al día.",
        feature1: "60 videos por mes (2 publicaciones por día)",
      },
    },
    categories: {
      joke: "Chiste Gracioso",
      motivational: "Motivación Diaria",
      scary: "Historia de Terror",
      history: "Datos Históricos",
      reddit: "Historia de Reddit",
      "reddit-relationship": "Relación de Reddit",
    },
    artStyles: {
      cartoon: "Dibujos Animados",
      horror: "Terror",
      realistic: "Realista",
      anime: "Anime",
      ghibli: "Ghibli",
    },
    durations: {
      "30": "Corto",
      "70": "Largo",
    },
    footer: {
      copyright: "© {{year}} Viral Faceless Reels. Todos los derechos reservados.",
    },
    whyChooseUs: {
      title: "¿Por Qué Elegirnos?",
      subtitle: "Comienza a construir tu flujo de ingresos pasivos hoy con la creación de videos impulsada por IA",
      card1: {
        title: "No Se Requiere Rostro",
        description: "Crea contenido atractivo sin mostrar tu rostro. Perfecto para introvertidos o cualquiera que quiera privacidad mientras construye su marca.",
      },
      card2: {
        title: "No Se Necesitan Editores",
        description: "Omite editores de video costosos. Nuestra IA maneja todo desde el guión hasta el video final, ahorrándote cientos de dólares mensualmente.",
      },
      card3: {
        title: "De Horas a Minutos",
        description: "Lo que solía tomar horas de edición, grabación y producción ahora toma solo un par de minutos. Enfócate en escalar, no en crear.",
      },
      card4: {
        title: "Listo para Ingresos Pasivos",
        description: "Genera contenido ilimitado para TikTok, Instagram y YouTube. Construye múltiples flujos de ingresos mientras duermes.",
      },
    },
    reviews: {
      title: "Lo Que Dicen Nuestros Usuarios",
      subtitle: "Únete a miles de creadores construyendo ingresos pasivos con videos impulsados por IA",
    },
    aiProviders: {
      title: "Impulsado por los mejores proveedores de IA",
      subtitle: "Aprovechando tecnología de IA de vanguardia de líderes de la industria",
    },
    faq: {
      title: "Preguntas Frecuentes",
      subtitle: "Todo lo que necesitas saber sobre nuestra plataforma",
      questions: [
        {
          question: "¿Cómo funciona la generación de videos con IA?",
          answer: "Nuestra plataforma utiliza modelos de IA avanzados para generar guiones, crear visuales y producir voces naturales. Simplemente elige tus configuraciones y nuestra IA maneja todo el proceso de creación de video automáticamente.",
        },
        {
          question: "¿Necesito experiencia en edición de video?",
          answer: "¡Para nada! Nuestra plataforma está diseñada para todos, sin importar las habilidades técnicas. La IA maneja toda la edición compleja, para que puedas enfocarte en crear contenido y hacer crecer tu audiencia.",
        },
        {
          question: "¿Puedo monetizar los videos que creo?",
          answer: "¡Sí! Todos los videos creados con nuestra plataforma son tuyos para usar comercialmente. Puedes monetizarlos en TikTok, YouTube, Instagram y cualquier otra plataforma que elijas.",
        },
        {
          question: "¿Cuánto tiempo tarda en generarse un video?",
          answer: "La mayoría de los videos se generan en 3-5 minutos, dependiendo de la duración y complejidad.",
        },
        {
          question: "¿Qué idiomas están soportados?",
          answer: "Soportamos más de 25 idiomas incluyendo inglés, español, francés, alemán, portugués y muchos más. Puedes crear contenido para audiencias globales con voces naturales en cada idioma.",
        },
        {
          question: "¿Puedo cancelar mi suscripción en cualquier momento?",
          answer: "Sí, puedes cancelar tu suscripción en cualquier momento. No hay compromisos a largo plazo ni tarifas de cancelación. Tu suscripción permanecerá activa hasta el final de tu período de facturación. Para cancelar tu suscripción, puedes acceder al área de suscripciones, hacer clic para cambiar de plan y cancelar la suscripción.",
        },
      ],
    },
    languages: {
      en: "Inglés",
      es: "Español",
      fr: "Francés",
      de: "Alemán",
      pt: "Portugués",
      it: "Italiano",
      nl: "Holandés",
      pl: "Polaco",
      ru: "Ruso",
      zh: "Chino",
      ja: "Japonés",
      ko: "Coreano",
      ar: "Árabe",
      hi: "Hindi",
      tr: "Turco",
      sv: "Sueco",
      da: "Danés",
      no: "Noruego",
      fi: "Finlandés",
      id: "Indonesio",
      vi: "Vietnamita",
      th: "Tailandés",
      uk: "Ucraniano",
      cs: "Checo",
      ro: "Rumano",
    },
    messages: {
      signInRequired: "¡Por favor inicia sesión para generar videos!",
      scriptRequired: "¡Por favor genera o escribe un guión primero!",
      voicePreviewError: 'Vista previa de voz para "{{voice}}" en {{language}} no encontrada. Por favor genera muestras de voz primero.',
    },
    errors: {
      insufficientCredits: {
        title: "Créditos Insuficientes",
        message: "No tienes suficientes créditos para generar este video. Por favor actualiza tu plan o espera a que se renueven tus créditos.",
      },
      generic: {
        title: "Algo salió mal",
        message: "Ocurrió un error al generar tu video. Por favor intenta de nuevo.",
      },
    },
    dashboard: {
      menu: {
        videoCreation: "Creación de Videos",
        socialMedia: "Vincular Redes Sociales",
      },
       socialMedia: {
         title: "Vincula tus Cuentas de Redes Sociales",
         subtitle: "Conecta tus cuentas para subir videos automáticamente",
         connect: "Conectar",
         disconnect: "Desconectar",
         connected: "Conectado",
         notConnected: "No conectado",
         connecting: "Conectando...",
         disconnecting: "Desconectando...",
         description: "Conecta tus cuentas de redes sociales para subir automáticamente tus videos generados. Esta función estará disponible pronto.",
         disconnectConfirm: "¿Estás seguro de que quieres desconectar {platform}?",
         connectSuccess: "¡Conectado exitosamente a {platform}!",
         disconnectSuccess: "Desconectado exitosamente de {platform}",
         connectError: "Error al conectar con {platform}",
         disconnectError: "Error al desconectar de {platform}",
       },
    },
  },
  fr: {
    nav: {
      features: "Fonctionnalités",
      pricing: "Tarifs",
      faq: "FAQ",
      login: "Connexion",
      signUp: "S'inscrire",
      signOut: "Déconnexion",
    },
    hero: {
      badge: "Automatisation par IA",
      headline1: "Créez des Vidéos Courtes Virales",
      headline2: "en Quelques Secondes",
      subheadline: "Automatisez vos chaînes sans visage sur TikTok et Instagram. Générez des scripts, des visuels et des voix captivants en un seul clic.",
      cta: "Générer une Vidéo",
      demo: "Voir la Démo",
    },
    form: {
      title: "Configurez votre Vidéo",
      subtitle: "Choisissez un sujet viral ou écrivez le vôtre.",
      videoType: "Type de Vidéo",
      gameplay: "Vidéo de Fond + Voix IA",
      gameplayDesc: "Vidéo de fond avec voix générée par IA",
      aiImages: "Vidéo Entièrement IA",
      aiImagesDesc: "Vidéo entièrement générée par IA avec visuels et voix",
      voiceLanguage: "Langue de la Voix",
      narratorVoice: "Voix du Narrateur",
      artStyle: "Style d'Art",
      category: "Catégorie Virale",
      duration: "Durée",
      script: "Script Vidéo",
      scriptPlaceholder: "Entrez votre script ici ou générez-en un...",
      generateAI: "Générer avec IA",
      createVideo: "Créer une Vidéo",
      generating: "Génération Magique...",
      generateAnother: "Générer un Autre",
      download: "Télécharger",
      mockMode: "Utiliser des Données de Test (Ignorer les appels API)",
      mockPlaceholder: '{"audioUrl": "...", "subtitles": "...", "generatedImages": [...], ...}',
      clearMock: "Effacer les Données de Test",
      pasteJson: "Collez ici la réponse JSON de Edge Function:",
      close: "Fermer",
      upgradePlan: "Mettre à Niveau",
      customPrompt: "Invite personnalisée (facultatif)",
      customPromptPlaceholder: "Ajoutez des détails spécifiques pour votre vidéo...",
    },
    steps: {
      videoType: "Type de Vidéo",
      categoryDuration: "Catégorie et Durée",
      voiceSettings: "Paramètres de Voix",
      artStyle: "Style d'Art",
      script: "Script",
      stepOf: "Étape {current} sur {total}",
      back: "Retour",
      next: "Suivant",
      selectVideoType: "Sélectionnez le Type de Vidéo",
      selectVideoTypeDesc: "Choisissez comment les visuels de votre vidéo seront générés",
      chooseCategoryDuration: "Catégorie et Durée",
      chooseCategoryDurationDesc: "Sélectionnez une catégorie virale et la durée de la vidéo",
      chooseVoice: "Paramètres de Voix",
      chooseVoiceDesc: "Sélectionnez la langue et la voix du narrateur",
      chooseArtStyle: "Style d'Art",
      chooseArtStyleDesc: "Choisissez le style visuel pour vos images générées par IA",
      writeScript: "Écrivez Votre Script",
      writeScriptDesc: "Entrez votre script ou générez-en un avec l'IA",
      videoReady: "Votre Vidéo est Prête!",
      videoReadyDesc: "Prévisualisez votre vidéo et téléchargez-la",
      monetizable: "TikTok",
      monetizableHint: "Les vidéos de 60s+ peuvent être monétisées sur TikTok",
    },
    pricing: {
      title: "Tarifs Simples et Transparents",
      subtitle: "Choisissez le plan qui correspond à vos besoins. Tous les plans incluent nos fonctionnalités principales.",
      mostPopular: "Le Plus Populaire",
      perMonth: "/mois",
      getStarted: "Commencer",
      common: {
        feature1: "Création de contenu complète",
        feature2: "Différents styles artistiques",
        feature3: "Voix IA personnalisée",
        feature4: "Sans filigrane",
      },
      starter: {
        name: "Débutant",
        description: "Parfait pour les créateurs qui commencent avec du contenu régulier.",
        feature1: "12 vidéos par mois (3 publications par semaine)",
      },
      professional: {
        name: "Professionnel",
        description: "Idéal pour les créateurs de contenu quotidien qui veulent grandir rapidement.",
        feature1: "30 vidéos par mois (1 publication par jour)",
      },
      elite: {
        name: "Élite",
        description: "Pour les créateurs sérieux et les agences qui publient plusieurs fois par jour.",
        feature1: "60 vidéos par mois (2 publications par jour)",
      },
    },
    categories: {
      joke: "Blague Drôle",
      motivational: "Motivation Quotidienne",
      scary: "Histoire Effrayante",
      history: "Faits Historiques",
      reddit: "Histoire Reddit",
      "reddit-relationship": "Relation Reddit",
    },
    artStyles: {
      cartoon: "Dessin Animé",
      horror: "Horreur",
      realistic: "Réaliste",
      anime: "Anime",
      ghibli: "Ghibli",
    },
    durations: {
      "30": "Court",
      "70": "Long",
    },
    footer: {
      copyright: "© {{year}} Viral Faceless Reels. Tous droits réservés.",
    },
    whyChooseUs: {
      title: "Pourquoi Nous Choisir?",
      subtitle: "Commencez à construire votre flux de revenus passifs aujourd'hui avec la création de vidéos alimentée par l'IA",
      card1: {
        title: "Pas Besoin de Visage",
        description: "Créez du contenu engageant sans montrer votre visage. Parfait pour les introvertis ou quiconque souhaite la confidentialité tout en construisant sa marque.",
      },
      card2: {
        title: "Pas Besoin d'Éditeurs",
        description: "Évitez les éditeurs vidéo coûteux. Notre IA gère tout du script à la vidéo finale, vous faisant économiser des centaines de dollars par mois.",
      },
      card3: {
        title: "D'Heures à Minutes",
        description: "Ce qui prenait des heures d'édition, d'enregistrement et de production ne prend maintenant que quelques minutes. Concentrez-vous sur la mise à l'échelle, pas sur la création.",
      },
      card4: {
        title: "Prêt pour les Revenus Passifs",
        description: "Générez du contenu illimité pour TikTok, Instagram et YouTube. Construisez plusieurs flux de revenus pendant que vous dormez.",
      },
    },
    reviews: {
      title: "Ce Que Disent Nos Utilisateurs",
      subtitle: "Rejoignez des milliers de créateurs qui construisent des revenus passifs avec des vidéos alimentées par l'IA",
    },
    aiProviders: {
      title: "Propulsé par les meilleurs fournisseurs d'IA",
      subtitle: "Tirant parti de la technologie d'IA de pointe des leaders de l'industrie",
    },
    faq: {
      title: "Questions Fréquemment Posées",
      subtitle: "Tout ce que vous devez savoir sur notre plateforme",
      questions: [
        {
          question: "Comment fonctionne la génération de vidéos par IA?",
          answer: "Notre plateforme utilise des modèles d'IA avancés pour générer des scripts, créer des visuels et produire des voix naturelles. Choisissez simplement vos paramètres et notre IA gère tout le processus de création vidéo automatiquement.",
        },
        {
          question: "Ai-je besoin d'expérience en montage vidéo?",
          answer: "Pas du tout! Notre plateforme est conçue pour tout le monde, peu importe les compétences techniques. L'IA gère tout le montage complexe, vous pouvez donc vous concentrer sur la création de contenu et la croissance de votre audience.",
        },
        {
          question: "Puis-je monétiser les vidéos que je crée?",
          answer: "Oui! Toutes les vidéos créées avec notre plateforme sont les vôtres à utiliser commercialement. Vous pouvez les monétiser sur TikTok, YouTube, Instagram et toute autre plateforme de votre choix.",
        },
        {
          question: "Combien de temps faut-il pour générer une vidéo?",
          answer: "La plupart des vidéos sont générées en 3-5 minutes, selon la durée et la complexité.",
        },
        {
          question: "Quelles langues sont prises en charge?",
          answer: "Nous prenons en charge plus de 25 langues dont l'anglais, l'espagnol, le français, l'allemand, le portugais et bien d'autres. Vous pouvez créer du contenu pour des audiences mondiales avec des voix naturelles dans chaque langue.",
        },
        {
          question: "Puis-je annuler mon abonnement à tout moment?",
          answer: "Oui, vous pouvez annuler votre abonnement à tout moment. Il n'y a pas d'engagement à long terme ni de frais d'annulation. Votre abonnement restera actif jusqu'à la fin de votre période de facturation. Pour annuler votre abonnement, vous pouvez accéder à la zone d'abonnements, cliquer pour changer de plan et annuler l'abonnement.",
        },
      ],
    },
    languages: {
      en: "Anglais",
      es: "Espagnol",
      fr: "Français",
      de: "Allemand",
      pt: "Portugais",
      it: "Italien",
      nl: "Néerlandais",
      pl: "Polonais",
      ru: "Russe",
      zh: "Chinois",
      ja: "Japonais",
      ko: "Coréen",
      ar: "Arabe",
      hi: "Hindi",
      tr: "Turc",
      sv: "Suédois",
      da: "Danois",
      no: "Norvégien",
      fi: "Finnois",
      id: "Indonésien",
      vi: "Vietnamien",
      th: "Thaï",
      uk: "Ukrainien",
      cs: "Tchèque",
      ro: "Roumain",
    },
    messages: {
      signInRequired: "Veuillez vous connecter pour générer des vidéos!",
      scriptRequired: "Veuillez générer ou écrire un script d'abord!",
      voicePreviewError: 'Aperçu vocal pour "{{voice}}" en {{language}} introuvable. Veuillez générer des échantillons vocaux d\'abord.',
    },
    errors: {
      insufficientCredits: {
        title: "Crédits Insuffisants",
        message: "Vous n'avez pas assez de crédits pour générer cette vidéo. Veuillez mettre à niveau votre forfait ou attendre le renouvellement de vos crédits.",
      },
      generic: {
        title: "Une erreur s'est produite",
        message: "Une erreur s'est produite lors de la génération de votre vidéo. Veuillez réessayer.",
      },
    },
    dashboard: {
      menu: {
        videoCreation: "Création de Vidéos",
        socialMedia: "Lier les Réseaux Sociaux",
      },
       socialMedia: {
         title: "Liez vos Comptes de Réseaux Sociaux",
         subtitle: "Connectez vos comptes pour télécharger automatiquement des vidéos",
         connect: "Connecter",
         disconnect: "Déconnecter",
         connected: "Connecté",
         notConnected: "Non connecté",
         connecting: "Connexion...",
         disconnecting: "Déconnexion...",
         description: "Connectez vos comptes de réseaux sociaux pour télécharger automatiquement vos vidéos générées. Cette fonctionnalité sera bientôt disponible.",
         disconnectConfirm: "Êtes-vous sûr de vouloir déconnecter {platform}?",
         connectSuccess: "Connecté avec succès à {platform}!",
         disconnectSuccess: "Déconnecté avec succès de {platform}",
         connectError: "Échec de la connexion à {platform}",
         disconnectError: "Échec de la déconnexion de {platform}",
       },
    },
  },
  pt: {
    nav: {
      features: "Recursos",
      pricing: "Preços",
      faq: "Perguntas Frequentes",
      login: "Entrar",
      signUp: "Cadastrar",
      signOut: "Sair",
    },
    hero: {
      badge: "Automação com IA",
      headline1: "Crie Vídeos Curtos Virais",
      headline2: "em Segundos",
      subheadline: "Automatize seus canais sem rosto no TikTok e Instagram. Gere roteiros, visuais e narrações envolventes com apenas um clique.",
      cta: "Gerar Vídeo",
      demo: "Ver Demo",
    },
    form: {
      title: "Configure seu Vídeo",
      subtitle: "Escolha um tópico viral ou escreva o seu.",
      videoType: "Tipo de Vídeo",
      gameplay: "Vídeo de Fundo + Voz IA",
      gameplayDesc: "Vídeo de fundo com voz gerada por IA",
      aiImages: "Vídeo Totalmente IA",
      aiImagesDesc: "Vídeo totalmente gerado por IA com visuais e voz",
      voiceLanguage: "Idioma da Voz",
      narratorVoice: "Voz do Narrador",
      artStyle: "Estilo de Arte",
      category: "Categoria Viral",
      duration: "Duração",
      script: "Roteiro do Vídeo",
      scriptPlaceholder: "Digite seu roteiro aqui ou gere um...",
      generateAI: "Gerar com IA",
      createVideo: "Criar Vídeo",
      generating: "Gerando Mágica...",
      generateAnother: "Gerar Outro",
      download: "Baixar",
      mockMode: "Usar Dados de Teste (Pular chamadas API)",
      mockPlaceholder: '{"audioUrl": "...", "subtitles": "...", "generatedImages": [...], ...}',
      clearMock: "Limpar Dados de Teste",
      pasteJson: "Cole aqui a resposta JSON da Edge Function:",
      close: "Fechar",
      upgradePlan: "Atualizar Plano",
      customPrompt: "Prompt personalizado (opcional)",
      customPromptPlaceholder: "Adicione detalhes específicos para o seu vídeo...",
    },
    steps: {
      videoType: "Tipo de Vídeo",
      categoryDuration: "Categoria e Duração",
      voiceSettings: "Configurações de Voz",
      artStyle: "Estilo de Arte",
      script: "Roteiro",
      stepOf: "Passo {current} de {total}",
      back: "Voltar",
      next: "Próximo",
      selectVideoType: "Selecione o Tipo de Vídeo",
      selectVideoTypeDesc: "Escolha como os visuais do seu vídeo serão gerados",
      chooseCategoryDuration: "Categoria e Duração",
      chooseCategoryDurationDesc: "Selecione uma categoria viral e a duração do vídeo",
      chooseVoice: "Configurações de Voz",
      chooseVoiceDesc: "Selecione o idioma e a voz do narrador",
      chooseArtStyle: "Estilo de Arte",
      chooseArtStyleDesc: "Escolha o estilo visual para suas imagens geradas por IA",
      writeScript: "Escreva seu Roteiro",
      writeScriptDesc: "Digite seu roteiro ou gere um com IA",
      videoReady: "Seu Vídeo está Pronto!",
      videoReadyDesc: "Visualize seu vídeo e faça o download",
      monetizable: "TikTok",
      monetizableHint: "Vídeos de 60s+ podem ser monetizados no TikTok",
    },
    pricing: {
      title: "Preços Simples e Transparentes",
      subtitle: "Escolha o plano que se adapta às suas necessidades. Todos os planos incluem nossos recursos principais.",
      mostPopular: "Mais Popular",
      perMonth: "/mês",
      getStarted: "Começar",
      common: {
        feature1: "Criação de conteúdo completa",
        feature2: "Diferentes estilos artísticos",
        feature3: "Voz IA personalizada",
        feature4: "Sem marca d'água",
      },
      starter: {
        name: "Inicial",
        description: "Perfeito para criadores que estão começando com conteúdo consistente.",
        feature1: "12 vídeos por mês (3 publicações por semana)",
      },
      professional: {
        name: "Profissional",
        description: "Ideal para criadores de conteúdo diário que querem crescer rápido.",
        feature1: "30 vídeos por mês (1 publicação por dia)",
      },
      elite: {
        name: "Elite",
        description: "Para criadores sérios e agências que publicam várias vezes por dia.",
        feature1: "60 vídeos por mês (2 publicações por dia)",
      },
    },
    categories: {
      joke: "Piada Engraçada",
      motivational: "Motivação Diária",
      scary: "História de Terror",
      history: "Fatos Históricos",
      reddit: "História do Reddit",
      "reddit-relationship": "Relacionamento Reddit",
    },
    artStyles: {
      cartoon: "Desenho Animado",
      horror: "Terror",
      realistic: "Realista",
      anime: "Anime",
      ghibli: "Ghibli",
    },
    durations: {
      "30": "Curto",
      "70": "Longo",
    },
    footer: {
      copyright: "© {{year}} Viral Faceless Reels. Todos os direitos reservados.",
    },
    whyChooseUs: {
      title: "Por Que Nos Escolher?",
      subtitle: "Comece a construir sua fonte de renda passiva hoje com criação de vídeos alimentada por IA",
      card1: {
        title: "Sem Rosto Necessário",
        description: "Crie conteúdo envolvente sem mostrar seu rosto. Perfeito para introvertidos ou qualquer pessoa que queira privacidade enquanto constrói sua marca.",
      },
      card2: {
        title: "Sem Editores Necessários",
        description: "Pule editores de vídeo caros. Nossa IA cuida de tudo, do roteiro ao vídeo final, economizando centenas de dólares mensalmente.",
      },
      card3: {
        title: "De Horas para Minutos",
        description: "O que costumava levar horas de edição, gravação e produção agora leva apenas alguns minutos. Foque em escalar, não em criar.",
      },
      card4: {
        title: "Pronto para Renda Passiva",
        description: "Gere conteúdo ilimitado para TikTok, Instagram e YouTube. Construa múltiplas fontes de receita enquanto você dorme.",
      },
    },
    reviews: {
      title: "O Que Nossos Usuários Dizem",
      subtitle: "Junte-se a milhares de criadores construindo renda passiva com vídeos alimentados por IA",
    },
    aiProviders: {
      title: "Alimentado pelos melhores provedores de IA",
      subtitle: "Aproveitando tecnologia de IA de ponta dos líderes da indústria",
    },
    faq: {
      title: "Perguntas Frequentes",
      subtitle: "Tudo o que você precisa saber sobre nossa plataforma",
      questions: [
        {
          question: "Como funciona a geração de vídeos com IA?",
          answer: "Nossa plataforma usa modelos de IA avançados para gerar roteiros, criar visuais e produzir vozes naturais. Simplesmente escolha suas configurações e nossa IA cuida de todo o processo de criação de vídeo automaticamente.",
        },
        {
          question: "Preciso de experiência em edição de vídeo?",
          answer: "De jeito nenhum! Nossa plataforma é projetada para todos, independentemente das habilidades técnicas. A IA cuida de toda a edição complexa, para que você possa focar em criar conteúdo e aumentar sua audiência.",
        },
        {
          question: "Posso monetizar os vídeos que crio?",
          answer: "Sim! Todos os vídeos criados com nossa plataforma são seus para usar comercialmente. Você pode monetizá-los no TikTok, YouTube, Instagram e qualquer outra plataforma que escolher.",
        },
        {
          question: "Quanto tempo leva para gerar um vídeo?",
          answer: "A maioria dos vídeos é gerada em 3-5 minutos, dependendo da duração e complexidade.",
        },
        {
          question: "Quais idiomas são suportados?",
          answer: "Suportamos mais de 25 idiomas incluindo inglês, espanhol, francês, alemão, português e muitos mais. Você pode criar conteúdo para audiências globais com vozes naturais em cada idioma.",
        },
        {
          question: "Posso cancelar minha assinatura a qualquer momento?",
          answer: "Sim, você pode cancelar sua assinatura a qualquer momento. Não há compromissos de longo prazo nem taxas de cancelamento. Sua assinatura permanecerá ativa até o final do seu período de cobrança. Para cancelar sua assinatura, você pode acessar a area de assinaturas, clicar para trocar de plano e cancelar a assinatura.",
        },
      ],
    },
    languages: {
      en: "Inglês",
      es: "Espanhol",
      fr: "Francês",
      de: "Alemão",
      pt: "Português",
      it: "Italiano",
      nl: "Holandês",
      pl: "Polonês",
      ru: "Russo",
      zh: "Chinês",
      ja: "Japonês",
      ko: "Coreano",
      ar: "Árabe",
      hi: "Hindi",
      tr: "Turco",
      sv: "Sueco",
      da: "Dinamarquês",
      no: "Norueguês",
      fi: "Finlandês",
      id: "Indonésio",
      vi: "Vietnamita",
      th: "Tailandês",
      uk: "Ucraniano",
      cs: "Tcheco",
      ro: "Romeno",
    },
    messages: {
      signInRequired: "Por favor, faça login para gerar vídeos!",
      scriptRequired: "Por favor, gere ou escreva um roteiro primeiro!",
      voicePreviewError: 'Prévia de voz para "{{voice}}" em {{language}} não encontrada. Por favor, gere amostras de voz primeiro.',
    },
    errors: {
      insufficientCredits: {
        title: "Créditos Insuficientes",
        message: "Você não tem créditos suficientes para gerar este vídeo. Por favor, atualize seu plano ou aguarde a renovação dos seus créditos.",
      },
      generic: {
        title: "Algo deu errado",
        message: "Ocorreu um erro ao gerar seu vídeo. Por favor, tente novamente.",
      },
    },
    dashboard: {
      menu: {
        videoCreation: "Criação de Vídeos",
        socialMedia: "Vincular Redes Sociais",
      },
       socialMedia: {
         title: "Vincule suas Contas de Redes Sociais",
         subtitle: "Conecte suas contas para fazer upload automático de vídeos",
         connect: "Conectar",
         disconnect: "Desconectar",
         connected: "Conectado",
         notConnected: "Não conectado",
         connecting: "Conectando...",
         disconnecting: "Desconectando...",
         description: "Conecte suas contas de redes sociais para fazer upload automático dos seus vídeos gerados. Esta funcionalidade estará disponível em breve.",
         disconnectConfirm: "Tem certeza de que deseja desconectar {platform}?",
         connectSuccess: "Conectado com sucesso ao {platform}!",
         disconnectSuccess: "Desconectado com sucesso do {platform}",
         connectError: "Falha ao conectar ao {platform}",
         disconnectError: "Falha ao desconectar do {platform}",
       },
    },
  },
  de: {
    nav: {
      features: "Funktionen",
      pricing: "Preise",
      faq: "FAQ",
      login: "Anmelden",
      signUp: "Registrieren",
      signOut: "Abmelden",
    },
    hero: {
      badge: "KI-gestützte Automatisierung",
      headline1: "Erstelle virale Kurzvideos",
      headline2: "in Sekunden",
      subheadline: "Automatisiere deine gesichtslosen Kanäle auf TikTok und Instagram. Erstelle fesselnde Skripte, Visualisierungen und Voiceovers mit nur einem Klick.",
      cta: "Video Generieren",
      demo: "Demo Ansehen",
    },
    form: {
      title: "Konfiguriere dein Video",
      subtitle: "Wähle ein virales Thema oder schreibe dein eigenes.",
      videoType: "Videotyp",
      gameplay: "Hintergrundvideo + KI-Stimme",
      gameplayDesc: "Hintergrundvideo mit KI-generierter Stimme",
      aiImages: "Vollständiges KI-Video",
      aiImagesDesc: "Vollständig KI-generiertes Video mit Visuals und Stimme",
      voiceLanguage: "Sprachsprache",
      narratorVoice: "Erzählerstimme",
      artStyle: "Kunststil",
      category: "Virale Kategorie",
      duration: "Dauer",
      script: "Video-Skript",
      scriptPlaceholder: "Gib hier dein Skript ein oder generiere eines...",
      generateAI: "Mit KI Generieren",
      createVideo: "Video Erstellen",
      generating: "Generiere Magie...",
      generateAnother: "Weiteres Generieren",
      download: "Herunterladen",
      mockMode: "Testdaten Verwenden (API-Aufrufe Überspringen)",
      mockPlaceholder: '{"audioUrl": "...", "subtitles": "...", "generatedImages": [...], ...}',
      clearMock: "Testdaten Löschen",
      pasteJson: "JSON-Antwort der Edge-Funktion hier einfügen:",
      close: "Schließen",
      upgradePlan: "Plan Upgraden",
      customPrompt: "Benutzerdefinierte Anweisung (optional)",
      customPromptPlaceholder: "Füge spezifische Details für dein Video hinzu...",
    },
    steps: {
      videoType: "Videotyp",
      categoryDuration: "Kategorie & Dauer",
      voiceSettings: "Spracheinstellungen",
      artStyle: "Kunststil",
      script: "Skript",
      stepOf: "Schritt {current} von {total}",
      back: "Zurück",
      next: "Weiter",
      selectVideoType: "Videotyp Auswählen",
      selectVideoTypeDesc: "Wähle, wie deine Video-Visuals generiert werden",
      chooseCategoryDuration: "Kategorie & Dauer",
      chooseCategoryDurationDesc: "Wähle eine virale Kategorie und Videolänge",
      chooseVoice: "Spracheinstellungen",
      chooseVoiceDesc: "Wähle die Sprache und Erzählerstimme",
      chooseArtStyle: "Kunststil",
      chooseArtStyleDesc: "Wähle den visuellen Stil für deine KI-generierten Bilder",
      writeScript: "Schreibe dein Skript",
      writeScriptDesc: "Gib dein Skript ein oder generiere eines mit KI",
      videoReady: "Dein Video ist Fertig!",
      videoReadyDesc: "Schau dir dein Video an und lade es herunter",
      monetizable: "TikTok",
      monetizableHint: "Videos ab 60s können auf TikTok monetarisiert werden",
    },
    pricing: {
      title: "Einfache, Transparente Preise",
      subtitle: "Wähle den Plan, der deinen Anforderungen entspricht. Alle Pläne enthalten unsere Kernfunktionen.",
      mostPopular: "Am Beliebtesten",
      perMonth: "/Monat",
      getStarted: "Loslegen",
      common: {
        feature1: "Vollständige Content-Erstellung",
        feature2: "Verschiedene Kunststile",
        feature3: "Individuelle KI-Stimme",
        feature4: "Kein Wasserzeichen",
      },
      starter: {
        name: "Starter",
        description: "Perfekt für Ersteller, die mit konsistentem Content beginnen.",
        feature1: "12 Videos pro Monat (3 Posts pro Woche)",
      },
      professional: {
        name: "Professionell",
        description: "Ideal für tägliche Content-Ersteller, die schnell wachsen möchten.",
        feature1: "30 Videos pro Monat (1 Post pro Tag)",
      },
      elite: {
        name: "Elite",
        description: "Für ernsthafte Ersteller und Agenturen, die mehrmals täglich posten.",
        feature1: "60 Videos pro Monat (2 Posts pro Tag)",
      },
    },
    categories: {
      joke: "Witziger Witz",
      motivational: "Tägliche Motivation",
      scary: "Gruselgeschichte",
      history: "Historische Fakten",
      reddit: "Reddit-Geschichte",
      "reddit-relationship": "Reddit-Beziehung",
    },
    artStyles: {
      cartoon: "Cartoon",
      horror: "Horror",
      realistic: "Realistisch",
      anime: "Anime",
      ghibli: "Ghibli",
    },
    durations: {
      "30": "Kurz",
      "70": "Lang",
    },
    footer: {
      copyright: "© {{year}} Viral Faceless Reels. Alle Rechte vorbehalten.",
    },
    whyChooseUs: {
      title: "Warum Uns Wählen?",
      subtitle: "Beginnen Sie noch heute, Ihren passiven Einkommensstrom mit KI-gestützter Videoproduktion aufzubauen",
      card1: {
        title: "Kein Gesicht Erforderlich",
        description: "Erstellen Sie ansprechende Inhalte ohne Ihr Gesicht zu zeigen. Perfekt für Introvertierte oder alle, die Privatsphäre beim Aufbau ihrer Marke wünschen.",
      },
      card2: {
        title: "Keine Videoeditoren Nötig",
        description: "Überspringen Sie teure Videoeditoren. Unsere KI übernimmt alles vom Skript bis zum fertigen Video und spart Ihnen monatlich Hunderte von Dollar.",
      },
      card3: {
        title: "Von Stunden zu Minuten",
        description: "Was früher Stunden an Bearbeitung, Aufnahme und Produktion dauerte, dauert jetzt nur noch ein paar Minuten. Konzentrieren Sie sich auf Skalierung, nicht auf Erstellung.",
      },
      card4: {
        title: "Bereit für Passives Einkommen",
        description: "Generieren Sie unbegrenzte Inhalte für TikTok, Instagram und YouTube. Bauen Sie mehrere Einnahmequellen auf, während Sie schlafen.",
      },
    },
    reviews: {
      title: "Was Unsere Benutzer Sagen",
      subtitle: "Schließen Sie sich Tausenden von Creators an, die passives Einkommen mit KI-gestützten Videos aufbauen",
    },
    aiProviders: {
      title: "Unterstützt von den besten KI-Anbietern",
      subtitle: "Nutzung modernster KI-Technologie von Branchenführern",
    },
    faq: {
      title: "Häufig Gestellte Fragen",
      subtitle: "Alles, was Sie über unsere Plattform wissen müssen",
      questions: [
        {
          question: "Wie funktioniert die KI-Videogenerierung?",
          answer: "Unsere Plattform verwendet fortschrittliche KI-Modelle, um Skripte zu generieren, Visuals zu erstellen und natürlich klingende Voiceovers zu produzieren. Wählen Sie einfach Ihre Einstellungen und unsere KI übernimmt den gesamten Videoerstellungsprozess automatisch.",
        },
        {
          question: "Benötige ich Videobearbeitungserfahrung?",
          answer: "Überhaupt nicht! Unsere Plattform ist für jeden konzipiert, unabhängig von technischen Fähigkeiten. Die KI übernimmt die gesamte komplexe Bearbeitung, sodass Sie sich auf die Erstellung von Inhalten und das Wachstum Ihrer Zielgruppe konzentrieren können.",
        },
        {
          question: "Kann ich die erstellten Videos monetarisieren?",
          answer: "Ja! Alle mit unserer Plattform erstellten Videos gehören Ihnen zur kommerziellen Nutzung. Sie können sie auf TikTok, YouTube, Instagram und jeder anderen Plattform Ihrer Wahl monetarisieren.",
        },
        {
          question: "Wie lange dauert es, ein Video zu generieren?",
          answer: "Die meisten Videos werden in 3-5 Minuten generiert, abhängig von Länge und Komplexität.",
        },
        {
          question: "Welche Sprachen werden unterstützt?",
          answer: "Wir unterstützen über 25 Sprachen, darunter Englisch, Spanisch, Französisch, Deutsch, Portugiesisch und viele mehr. Sie können Inhalte für globale Zielgruppen mit natürlich klingenden Voiceovers in jeder Sprache erstellen.",
        },
        {
          question: "Kann ich mein Abonnement jederzeit kündigen?",
          answer: "Ja, Sie können Ihr Abonnement jederzeit kündigen. Es gibt keine langfristigen Verpflichtungen oder Kündigungsgebühren. Ihr Abonnement bleibt bis zum Ende Ihres Abrechnungszeitraums aktiv. Um Ihr Abonnement zu kündigen, können Sie auf den Abonnementbereich zugreifen, auf Plan ändern klicken und das Abonnement kündigen.",
        },
      ],
    },
    languages: {
      en: "Englisch",
      es: "Spanisch",
      fr: "Französisch",
      de: "Deutsch",
      pt: "Portugiesisch",
      it: "Italienisch",
      nl: "Niederländisch",
      pl: "Polnisch",
      ru: "Russisch",
      zh: "Chinesisch",
      ja: "Japanisch",
      ko: "Koreanisch",
      ar: "Arabisch",
      hi: "Hindi",
      tr: "Türkisch",
      sv: "Schwedisch",
      da: "Dänisch",
      no: "Norwegisch",
      fi: "Finnisch",
      id: "Indonesisch",
      vi: "Vietnamesisch",
      th: "Thailändisch",
      uk: "Ukrainisch",
      cs: "Tschechisch",
      ro: "Rumänisch",
    },
    messages: {
      signInRequired: "Bitte melde dich an, um Videos zu generieren!",
      scriptRequired: "Bitte generiere oder schreibe zuerst ein Skript!",
      voicePreviewError: 'Sprachvorschau für "{{voice}}" in {{language}} nicht gefunden. Bitte generiere zuerst Sprachproben.',
    },
    errors: {
      insufficientCredits: {
        title: "Unzureichende Credits",
        message: "Du hast nicht genügend Credits, um dieses Video zu generieren. Bitte aktualisiere deinen Plan oder warte auf die Erneuerung deiner Credits.",
      },
      generic: {
        title: "Etwas ist schief gelaufen",
        message: "Beim Generieren deines Videos ist ein Fehler aufgetreten. Bitte versuche es erneut.",
      },
    },
    dashboard: {
      menu: {
        videoCreation: "Videoerstellung",
        socialMedia: "Social Media Verknüpfen",
      },
       socialMedia: {
         title: "Verknüpfe deine Social Media Konten",
         subtitle: "Verbinde deine Konten, um Videos automatisch hochzuladen",
         connect: "Verbinden",
         disconnect: "Trennen",
         connected: "Verbunden",
         notConnected: "Nicht verbunden",
         connecting: "Verbinde...",
         disconnecting: "Trenne...",
         description: "Verknüpfe deine Social Media Konten, um deine generierten Videos automatisch hochzuladen. Diese Funktion wird bald verfügbar sein.",
         disconnectConfirm: "Bist du sicher, dass du {platform} trennen möchtest?",
         connectSuccess: "Erfolgreich mit {platform} verbunden!",
         disconnectSuccess: "Erfolgreich von {platform} getrennt",
         connectError: "Fehler beim Verbinden mit {platform}",
         disconnectError: "Fehler beim Trennen von {platform}",
       },
    },
  },
};

export type Language = keyof typeof translations;
export type TranslationKeys = typeof translations.en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  formatMessage: (message: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Initialize with saved language from localStorage
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("app-language") as Language;
      if (savedLang && translations[savedLang]) {
        return savedLang;
      }
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  };

  const formatMessage = (message: string, params?: Record<string, string | number>): string => {
    if (!params) return message;
    
    let formatted = message;
    Object.entries(params).forEach(([key, value]) => {
      formatted = formatted.replace(`{{${key}}}`, String(value));
    });
    return formatted;
  };

  const value: I18nContextType = {
    language,
    setLanguage,
    t: translations[language],
    formatMessage,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}