# Morpion — Le Jardin des Deux Dragons

## Intention

Un jeu de morpion pour deux personnes, dans une ambiance inspirée des jardins chinois, de la peinture à l’encre et des sceaux traditionnels. L’univers visuel habille le jeu sans modifier ses règles classiques.

## Objectif

Être la première personne à aligner trois de ses symboles horizontalement, verticalement ou en diagonale sur une grille de 3 × 3 cases.

## Joueurs et symboles

- Le jeu oppose exactement deux personnes.
- Chaque personne conserve le même symbole pendant toute la manche.
- Le premier camp utilise un dragon de jade, accompagné du repère X.
- Le second camp utilise un phénix vermillon, accompagné du repère O.
- Les repères X et O restent disponibles pour garantir la lisibilité : la couleur seule ne doit jamais servir à distinguer les camps.

Ces deux camps constituent un choix artistique propre au jeu, et non la reconstitution d’un jeu chinois traditionnel.

## Préparation

1. Afficher une grille vide de neuf cases, organisée en trois lignes et trois colonnes.
2. Attribuer les deux camps aux joueurs.
3. Tirer au sort la personne qui commence la première manche.
4. Afficher clairement le camp dont c’est le tour.

Pour les manches suivantes, alterner la personne qui commence, même après une égalité.

## Déroulement d’un tour

1. La personne active choisit une case vide.
2. Son symbole est placé dans cette case.
3. Le jeu vérifie si ce placement forme un alignement gagnant.
4. En l’absence de victoire, le jeu vérifie si la grille est pleine.
5. Si la manche continue, la main passe à l’autre personne.

Un symbole posé ne peut être ni déplacé, ni remplacé, ni retiré pendant la manche.

### Coup invalide

Un choix est invalide lorsque la case est déjà occupée, que ce n’est pas le tour du joueur ou que la manche est terminée.

- Aucun symbole n’est ajouté.
- Le plateau et le joueur actif restent inchangés.
- Un message discret explique pourquoi le coup est refusé.

## Conditions de fin

### Victoire

Une personne gagne dès qu’elle aligne trois de ses symboles sur l’une des huit lignes possibles :

- Les trois lignes horizontales.
- Les trois colonnes verticales.
- Les deux diagonales.

La manche s’arrête immédiatement. Les trois cases gagnantes sont mises en évidence et aucune nouvelle pose n’est autorisée.

### Égalité

Si les neuf cases sont occupées sans alignement gagnant, la manche se termine par une égalité.

La vérification de victoire doit précéder celle de l’égalité : le neuvième coup peut être gagnant.

## Rejouer et scores

- Une victoire rapporte un point au camp gagnant.
- Une égalité ne rapporte aucun point ; elle peut être comptabilisée séparément.
- L’action « Nouvelle manche » vide le plateau, conserve les scores et alterne le premier joueur.
- L’action « Réinitialiser la partie » vide le plateau, remet les scores à zéro et effectue un nouveau tirage au sort du premier joueur.
- Si une réinitialisation est demandée pendant une manche, demander confirmation avant de perdre la progression.

## Direction artistique : un jardin chinois à l’encre

### Ambiance

Privilégier une atmosphère calme et épurée : fond de papier ivoire, textures d’encre, touches de jade et de vermillon. Le plateau évoque un panneau de bois ou une feuille de papier travaillée au pinceau.

### Éléments visuels proposés

- Une grille sombre dont les traits rappellent un tracé au pinceau, tout en restant parfaitement lisibles.
- Des pions évoquant de petits sceaux : dragon de jade et phénix vermillon.
- Quelques silhouettes de bambou, de montagnes ou de toitures en arrière-plan, sans gêner le plateau.
- Une typographie française lisible ; réserver les effets calligraphiques aux titres.
- Des animations brèves : apparition du pion comme une empreinte d’encre, puis mise en lumière douce de l’alignement gagnant.

Éviter l’accumulation de clichés, le mélange arbitraire de références asiatiques et les caractères chinois décoratifs dont le sens n’a pas été vérifié. L’inspiration chinoise reste une direction artistique, pas une revendication d’authenticité historique.

### Son et accessibilité

- Prévoir, si souhaité, une ambiance instrumentale discrète inspirée des cordes pincées, sans effet sonore envahissant.
- Permettre de couper séparément la musique et les effets sonores.
- Respecter les préférences de réduction des animations.
- Conserver des contrastes suffisants et des symboles distinguables sans perception des couleurs.
- Permettre la sélection des cases au clavier, avec un indicateur de focus visible.
- Donner à chaque case un libellé indiquant sa ligne, sa colonne et son état.

## Textes d’interface proposés

| Situation | Texte |
| --- | --- |
| Début de manche | « Le jardin attend votre premier trait. » |
| Tour du dragon | « Au tour du Dragon de jade — X. » |
| Tour du phénix | « Au tour du Phénix vermillon — O. » |
| Case occupée | « Cette case porte déjà un sceau. » |
| Victoire du dragon | « Le Dragon de jade remporte la manche ! » |
| Victoire du phénix | « Le Phénix vermillon remporte la manche ! » |
| Égalité | « L’équilibre règne dans le jardin. Match nul. » |
| Rejouer | « Nouvelle manche » |

## Critères de validation

- Le plateau contient exactement neuf cases vides au lancement.
- Un coup valide remplit exactement une case et ne peut pas être annulé par un second clic.
- Les joueurs alternent après chaque coup valide qui ne termine pas la manche.
- Un coup invalide ne change ni le plateau, ni le tour, ni les scores.
- Chacun des huit alignements possibles est reconnu comme une victoire.
- Une victoire au neuvième coup n’est pas annoncée comme une égalité.
- Une grille pleine sans vainqueur déclenche une égalité.
- Les interactions de pose sont bloquées après la fin de la manche.
- Les points ne sont attribués qu’une seule fois par manche terminée.
- Une nouvelle manche conserve les scores et alterne le premier joueur.
- La direction artistique ne compromet ni la lecture des symboles ni l’utilisation du plateau.
